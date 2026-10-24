import * as T from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { createHuntChinchilla, animateHuntChinchilla, poseArms, type HuntChinchilla } from './hunt-chinchilla';
import { BEASTS, BEAST_IDS, GATHER_TIME, MATERIAL_IDS, SPOTS, type BeastId, type HuntGame, type HeroId, type MaterialId } from './grumble-hunt-game';
import { createHuntWeapons } from './grumble-hunt-weapons';
import { MATERIALS } from './grumble-hunt-content';

type Rig = { model: HuntChinchilla; hammer: T.Group; head: T.Group; trail: T.Line; points: T.Vector3[]; weapons: ReturnType<typeof createHuntWeapons>; armour: T.Group[] };
const RIDE_HEIGHT: Record<BeastId, number> = { bristleback: 2.4, puffwart: 2, skreel: 2.7, hornclack: 2.25, frostmane: 2.25 };
type BeastRig = { root: T.Group; body: T.Group; head: T.Group; legs: T.Group[]; wings: T.Group[]; eyes: T.Mesh[]; part: T.Group; brow: T.MeshToonMaterial; browColor: T.Color; steam: T.Mesh[]; throat?: T.Mesh; tongue?: T.Mesh; mane?: T.Group };
/** A gathering spot's props; `fruit` is what disappears once it is gathered. */
type SpotRig = { id: number; root: T.Group; fruit: T.Group; material: MaterialId };
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const lerp = T.MathUtils.lerp;
const noOutline = <M extends T.Material>(m: M): M => { m.userData.outlineParameters = { visible: false }; return m; };
const grumpyRed = new T.Color(0xd8432f);

/** Drawing only. The page owns the fixed engine clock and this object owns every GPU resource. */
export function createHuntScene(canvas: HTMLCanvasElement, ready: () => void, failed: (message: string) => void, preview: HeroId | null = null) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const phone = matchMedia('(pointer:coarse)').matches || innerWidth < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 1.5));
  renderer.toneMapping = T.NoToneMapping;
  renderer.info.autoReset = false;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = phone ? T.BasicShadowMap : T.PCFShadowMap;
  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.13, 0.09, 0.07] });
  const scene = new T.Scene(); scene.background = new T.Color(0xb7d9ee); scene.fog = new T.Fog(0xc8dfd2, 34, 90);
  const camera = new T.PerspectiveCamera(64, 1, 0.15, 180);
  const target = V(0, 1.5, 4);
  let yaw = 0, pitch = 0.4, dist = 8.8, userOrbit = 0, closed = false, currentWorld = '', frame = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const textures = new Set<T.Texture>();
  const loader = new T.TextureLoader();
  const ramp = new T.DataTexture(new Uint8Array([96, 178, 255]), 3, 1, T.RedFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true; textures.add(ramp);
  const materials = new Set<T.Material>();
  const geometries = new Set<T.BufferGeometry>();
  const toon = (color: number, map?: T.Texture, outlineOn = true) => {
    const m = new T.MeshToonMaterial({ color, gradientMap: ramp, map: map ?? null }); if (!outlineOn) noOutline(m); materials.add(m); return m;
  };
  function texture(name: string, repeat = 1) {
    const t = loader.load(`/art/hunt/${name}.webp`, (loaded) => { if (closed) loaded.dispose(); }, undefined, () => { if (!closed) failed('Some paintings could not load. The meadow is still playable. Reload to try them again.'); });
    t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textures.add(t); return t;
  }
  const grassMap = texture('tex-meadow-grass', 32), dirtMap = texture('tex-meadow-dirt', 5), bark = texture('tex-bark', 2), rock = texture('tex-rock', 2), fur = texture('tex-boar-fur', 3);
  const leaf = texture('leaf-cluster'), tuft = texture('grass-tuft');
  leaf.wrapS = leaf.wrapT = tuft.wrapS = tuft.wrapT = T.ClampToEdgeWrapping;
  const sky = loader.load('/art/hunt/sky-meadow.webp', (t) => { if (closed) t.dispose(); else { t.mapping = T.EquirectangularReflectionMapping; t.colorSpace = T.SRGBColorSpace; scene.background = t; } }, undefined, () => { if (!closed) failed('The sky painting is taking a nap. You can still play.'); });
  textures.add(sky);
  scene.add(new T.HemisphereLight(0xeaf6ff, 0x7c9d55, 1.4));
  const sun = new T.DirectionalLight(0xfff1da, 1.8); sun.position.set(12, 22, 14); sun.castShadow = true; sun.shadow.mapSize.setScalar(phone ? 512 : 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 }); sun.shadow.normalBias = 0.05; scene.add(sun, sun.target);
  const sphere = new T.SphereGeometry(1, 16, 12), ico = new T.IcosahedronGeometry(1, 1), cube = new T.BoxGeometry(1, 1, 1);
  const cylinder = new T.CylinderGeometry(1, 1, 1, 12), cone = new T.ConeGeometry(1, 1, 8), plane = new T.PlaneGeometry(1, 1);
  for (const g of [sphere, ico, cube, cylinder, cone, plane]) geometries.add(g);
  function mesh(parent: T.Object3D, geo: T.BufferGeometry, mat: T.Material, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], shadow = true) {
    const m = new T.Mesh(geo, mat); m.position.set(...pos); m.scale.set(...scale); if (!geo.boundingSphere) geo.computeBoundingSphere(); m.castShadow = shadow && (geo.boundingSphere?.radius ?? 1) * Math.max(...scale) > 0.22; m.receiveShadow = true; parent.add(m); geometries.add(geo); materials.add(mat); return m;
  }
  const groundMat = toon(0xd4dfbd, grassMap, false), dirtMat = toon(0xe8d9bd, dirtMap, false);
  const groundGeo = new T.PlaneGeometry(180, 180, 80, 80); groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.getAttribute('position');
  for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = gp.getZ(i), hill = T.MathUtils.smoothstep(Math.hypot(x, z), 22, 65); gp.setY(i, hill * (3 + Math.sin(x * 0.1) * 3 + Math.cos(z * 0.09) * 3)); }
  groundGeo.computeVertexNormals(); mesh(scene, groundGeo, groundMat, [0, 0, 0], [1, 1, 1], false);
  const world = new T.Group(), village = new T.Group(), paths = new T.Group(); scene.add(world, village, paths);
  const canopyPositions: T.Vector3[] = [], blockers: T.Object3D[] = [], spotRigs: SpotRig[] = [];
  let leafCards: T.InstancedMesh | null = null, crowns: T.InstancedMesh | null = null;
  // 1 = a tree's crown and leaf card fully shown, 0 = shrunk away because it would fill the camera's view.
  const canopyShown: number[] = [], upright = new T.Quaternion();
  const barkMat = toon(0xffffff, bark, false), rockMat = toon(0xc7cac0, rock), canopyMat = toon(0x548641, undefined, false), foliage = noOutline(new T.MeshToonMaterial({ color: 0xffffff, map: leaf, gradientMap: ramp, alphaTest: 0.35, side: T.DoubleSide })); materials.add(foliage);
  const tuftMat = noOutline(new T.MeshToonMaterial({ color: 0xffffff, map: tuft, gradientMap: ramp, alphaTest: 0.4, side: T.DoubleSide })); materials.add(tuftMat);
  let randomSeed = 61;
  const rnd = () => { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0; return randomSeed / 4294967296; };
  // One instanced draw for grass, no outlines or individual grass objects.
  const blade = new T.BufferGeometry(); blade.setAttribute('position', new T.Float32BufferAttribute([-0.045, 0, 0, 0.045, 0, 0, -0.025, 0.3, 0, 0.025, 0.3, 0, 0, 0.55, 0], 3)); blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]); blade.computeVertexNormals(); geometries.add(blade);
  const grassMat = toon(0x80b445, undefined, false); grassMat.side = T.DoubleSide;
  const wind = { value: 0 };
  grassMat.onBeforeCompile = (shader) => { shader.uniforms.uWind = wind; shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(uWind * 1.8 + instanceMatrix[3].x * .5 + instanceMatrix[3].z * .3) * position.y * position.y * .35;'); };
  const grass = new T.InstancedMesh(blade, grassMat, 5000); grass.receiveShadow = false; scene.add(grass);
  const grassTufts = new T.InstancedMesh(plane, tuftMat, 100); scene.add(grassTufts);
  const matrix = new T.Matrix4(), quat = new T.Quaternion(), tint = new T.Color();
  for (let i = 0; i < 5000; i++) {
    const a = rnd() * 6.283, r = 3 + Math.sqrt(rnd()) * 30, x = Math.cos(a) * r, z = Math.sin(a) * r;
    quat.setFromAxisAngle(V(0, 1, 0), rnd() * 6.283); const s = 0.6 + rnd() * 0.8;
    matrix.compose(V(x, 0.01, z), quat, V(s, s, s)); grass.setMatrixAt(i, matrix); grass.setColorAt(i, tint.setScalar(0.85 + rnd() * 0.3));
  }
  for (let i = 0; i < 100; i++) { const a = rnd() * 6.283, r = 5 + rnd() * 25; quat.setFromAxisAngle(V(0, 1, 0), rnd() * 6.283); matrix.compose(V(Math.cos(a) * r, 0.3, Math.sin(a) * r), quat, V(0.7, 0.6, 0.7)); grassTufts.setMatrixAt(i, matrix); }
  const hillMat = toon(0x739d64, undefined, false);
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; mesh(scene, sphere, hillMat, [Math.cos(a) * 63, 0, Math.sin(a) * 63], [23, 7 + rnd() * 5, 19], false); }

  const wood = toon(0x9b663b), cream = toon(0xffeac8), gold = toon(0xe6b653), roof = toon(0xb9664d), ink = toon(0x3e3031), rose = toon(0xe9a6a0);
  const berryMat = toon(0xd2344a), hayMat = toon(0xe2c46a), bushMat = toon(0x4f8a3c), reedMat = toon(0x7f9f45), cattailMat = toon(0x8a5a35);
  const crystalMat = noOutline(new T.MeshBasicMaterial({ color: 0xffc94a, toneMapped: false })); materials.add(crystalMat);
  for (const s of SPOTS) {
    const building = new T.Group(); village.add(building); building.position.set(s.x, 0, s.z);
    if (s.id === 'board') {
      for (const x of [-1.2, 1.2]) mesh(building, cylinder, wood, [x, 1.1, 0], [0.13, 2.2, 0.13]);
      blockers.push(mesh(building, cube, wood, [0, 1.75, 0], [2.8, 1.5, 0.25]));
      for (let i = 0; i < 3; i++) mesh(building, cube, cream, [-0.85 + i * 0.85, 1.8, 0.15], [0.6, 0.85, 0.03]);
    } else if (s.id === 'pantry') {
      // A market stall: four posts, a striped awning, a counter of berry and seed baskets, and a hay bale.
      building.rotation.y = 0.55;
      for (const x of [-1.3, 1.3]) for (const z of [-0.75, 0.75]) mesh(building, cylinder, wood, [x, 1.15, z], [0.08, 2.3, 0.08]);
      for (let i = 0; i < 5; i++) { const stripe = mesh(building, cube, i % 2 ? cream : rose, [-1.2 + i * 0.6, 2.4, 0.05], [0.6, 0.1, 2.0]); stripe.rotation.x = 0.22; }
      blockers.push(mesh(building, cube, wood, [0, 0.5, 0.35], [2.8, 1, 0.75]));
      for (const [x, fill] of [[-0.85, berryMat], [0, gold], [0.85, berryMat]] as const) {
        mesh(building, cylinder, toon(0xc79b5c), [x, 1.12, 0.35], [0.3, 0.22, 0.3]);
        for (let k = 0; k < 5; k++) mesh(building, sphere, fill, [x + Math.cos(k * 1.3) * 0.15, 1.27 + (k % 2) * 0.04, 0.35 + Math.sin(k * 1.3) * 0.15], [0.09, 0.09, 0.09], false);
      }
      const bale = mesh(building, cylinder, hayMat, [1.85, 0.42, 0.7], [0.42, 0.85, 0.42]); bale.rotation.z = Math.PI / 2;
    } else {
      const wall = mesh(building, cube, s.id === 'forge' ? wood : cream, [0, 1, 0], [3.4, 2, 2.5]); blockers.push(wall);
      const top = mesh(building, cone, s.id === 'forge' ? roof : toon(0x6c9778), [0, 2.65, 0], [2.6, 1.5, 2.1]); top.rotation.y = Math.PI / 4;
      mesh(building, cube, ink, [0, 0.75, 1.27], [0.85, 1.5, 0.05]);
      mesh(building, cube, gold, [1, 1.1, 1.28], [0.6, 0.65, 0.04]);
      if (s.id === 'forge') { mesh(building, cylinder, rockMat, [-1, 2.7, -0.3], [0.35, 2.5, 0.35]); mesh(building, cube, rockMat, [0, 0.7, 2.1], [1.1, 0.3, 0.7]); }
      else { for (let i = 0; i < 4; i++) mesh(building, cube, [roof, gold, foliage, wood][i], [1.9, 0.3 + i * 0.2, 1.2], [0.65, 0.16, 0.8]); }
    }
    const length = Math.hypot(s.x, s.z - 5), path = mesh(paths, plane, dirtMat, [s.x / 2, 0.025, (s.z + 5) / 2], [2.3, length + 1, 1], false); path.rotation.set(-Math.PI / 2, 0, -Math.atan2(s.x, 5 - s.z));
  }
  const villageBlockerCount = blockers.length;
  const campPath = mesh(scene, plane, dirtMat, [0, 0.015, 12], [3.5, 10, 1], false); campPath.rotation.x = -Math.PI / 2;
  function buildWorld(game: HuntGame) {
    // Reuse a shared set of geometries and materials when hunts change.
    while (world.children.length) { const child = world.children[0]; if (child instanceof T.InstancedMesh) child.dispose(); world.remove(child); }
    canopyPositions.length = 0; canopyShown.length = 0;
    blockers.length = villageBlockerCount;
    const trees = game.obstacles.filter((o) => o.kind === 'tree');
    const trunks = new T.InstancedMesh(cylinder, barkMat, trees.length);
    crowns = new T.InstancedMesh(ico, canopyMat, trees.length);
    leafCards = new T.InstancedMesh(plane, foliage, trees.length);
    trunks.castShadow = true; trunks.receiveShadow = true;
    world.add(trunks, crowns!, leafCards); blockers.push(trunks);
    const identity = new T.Quaternion();
    trees.forEach((o, i) => {
      matrix.compose(V(o.x, 2, o.z), identity, V(o.r * 0.65, 4, o.r * 0.65)); trunks.setMatrixAt(i, matrix);
      matrix.compose(V(o.x, 3.7, o.z), identity, V(1.6, 1.5, 1.6)); crowns!.setMatrixAt(i, matrix);
      canopyPositions.push(V(o.x, 4.2, o.z)); canopyShown.push(1);
      matrix.compose(V(o.x, 4.2, o.z), identity, V(5, 4.4, 1)); leafCards!.setMatrixAt(i, matrix);
    });
    for (const o of game.obstacles) {
      if (o.kind === 'rock') { const m = mesh(world, ico, rockMat, [o.x, o.r * 0.5, o.z], [o.r, o.r * 0.8, o.r]); m.rotation.y = o.x; blockers.push(m); }
    }
    spotRigs.length = 0;
    for (const s of game.spots) {
      const root = new T.Group(), fruit = new T.Group(); root.position.set(s.x, 0, s.z); root.rotation.y = s.id; root.add(fruit); world.add(root);
      if (s.material === 'berry') {
        mesh(root, ico, bushMat, [0, 0.55, 0], [0.8, 0.62, 0.8]);
        for (let k = 0; k < 8; k++) { const a = k * 2.3, y = 0.45 + (k % 3) * 0.2; mesh(fruit, sphere, berryMat, [Math.cos(a) * 0.72, y, Math.sin(a) * 0.72], [0.11, 0.11, 0.11], false); }
      } else if (s.material === 'marsh-reed') {
        for (let k = 0; k < 7; k++) { const a = k * 2.1, r = 0.12 + (k % 3) * 0.14, tall = 1 + (k % 2) * 0.35, x = Math.cos(a) * r, z = Math.sin(a) * r;
          const stalk = mesh(root, cylinder, reedMat, [x, tall / 2, z], [0.035, tall, 0.035], false); stalk.rotation.z = (k % 3 - 1) * 0.08;
          mesh(fruit, cylinder, cattailMat, [x, tall + 0.1, z], [0.075, 0.32, 0.075], false); }
      } else {
        mesh(root, ico, rockMat, [0, 0.25, 0], [0.7, 0.4, 0.6]);
        for (let k = 0; k < 4; k++) { const c = mesh(fruit, starGeo, crystalMat, [Math.cos(k * 1.6) * 0.3, 0.6 + (k % 2) * 0.2, Math.sin(k * 1.6) * 0.3], [1.4, 2.6 - k * 0.3, 1.4], false); c.rotation.z = (k - 1.5) * 0.3; }
      }
      spotRigs.push({ id: s.id, root, fruit, material: s.material });
    }
  }
  function actor(white: boolean): Rig {
    const model = createHuntChinchilla(white); model.root.scale.setScalar(0.75); scene.add(model.root);
    const hammer = new T.Group(); model.body.add(hammer); hammer.position.set(0.4, 0.6, 0.5); hammer.scale.setScalar(1 / 0.75);
    mesh(hammer, cylinder, wood, [0, 0.39, 0], [0.034, 0.78, 0.034]);
    const head = new T.Group(); head.position.y = 0.82; head.rotation.z = Math.PI / 2; hammer.add(head);
    mesh(head, sphere, toon(0xc58a47), [0, -0.06, 0], [0.24, 0.29, 0.24]);
    mesh(head, sphere, wood, [0, 0.12, 0], [0.255, 0.12, 0.255]); mesh(head, cylinder, wood, [0, 0.28, 0], [0.025, 0.12, 0.025]);
    const trailGeo = new T.BufferGeometry().setFromPoints(Array.from({ length: 10 }, () => V())), trailMat = noOutline(new T.LineBasicMaterial({ color: 0xffd16b, transparent: true, opacity: 0.8 }));
    const trail = new T.Line(trailGeo, trailMat); trail.visible = false; geometries.add(trailGeo); materials.add(trailMat); scene.add(trail);
    hammer.visible = white;
    model.root.traverse((o) => { if (o instanceof T.Mesh) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); o.castShadow = (o.geometry.boundingSphere?.radius ?? 1) * Math.max(o.scale.x, o.scale.y, o.scale.z) > 0.22; geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(m); for (const t of Object.values(m)) if (t instanceof T.Texture) textures.add(t); } } else if (o instanceof T.Line) { geometries.add(o.geometry); materials.add(o.material as T.Material); } });
    const weapons = createHuntWeapons(model, toon, geometries, materials);
    const armour: T.Group[] = [];
    for (let i = 0; i < 3; i++) {
      const g = new T.Group(); (i === 0 ? model.head : model.body).add(g); armour.push(g);
      // Small crest, leaf vest and low puffy boots leave cheeks and ears clear.
      if (i === 0) mesh(g, sphere, toon(0xa77c52), [0, 0.43, 0], [0.16, 0.055, 0.13]);
      else if (i === 1) mesh(g, sphere, toon(0x76975a), [-0.06, 0.48, 0], [0.58, 0.29, 0.52]);
      else for (const z of [-0.3, 0.3]) mesh(g, sphere, toon(0xb28f62), [-0.22, 0.09, z], [0.21, 0.1, 0.14]);
      g.visible = false;
    }
    return { model, hammer, head, trail, points: [], weapons, armour };
  }
  const actors: Record<HeroId, Rig> = { dora: actor(true), enzo: actor(false) };

  const steamMat = noOutline(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })); materials.add(steamMat);
  function beastRig(id: BeastId): BeastRig {
    const root = new T.Group(), body = new T.Group(), head = new T.Group(), part = new T.Group(); root.add(body); body.add(head, part); scene.add(root);
    const legs: T.Group[] = [], wings: T.Group[] = [], eyes: T.Mesh[] = [];
    const colors = { bristleback: 0x9d754e, puffwart: 0x8c9948, skreel: 0x7189aa, hornclack: 0x7c8394, frostmane: 0xe3eff5 };
    const coat = toon(colors[id], id === 'bristleback' ? fur : undefined), dark = toon(id === 'frostmane' ? 0x91bedc : 0x483f3b);
    const belly = toon(id === 'skreel' ? 0xe9e4cf : 0xf3dfab);
    // Eyebrows get their own material so they can turn red when the beast is Extra Grumpy.
    const brow = toon(id === 'frostmane' ? 0x91bedc : 0x483f3b);
    const rig: BeastRig = { root, body, head, part, legs, wings, eyes, brow, browColor: brow.color.clone(), steam: [] };
    function eye(x: number, y: number, z: number, s: number) {
      const white = mesh(head, sphere, cream, [x, y, z], [0.1, 0.15, 0.17]); eyes.push(white);
      eyes.push(mesh(head, sphere, ink, [x + 0.07, y, z + s * 0.065], [0.08, 0.095, 0.095]));
      const b = mesh(head, cube, brow, [x + 0.04, y + 0.15, z], [0.14, 0.075, 0.4]); b.rotation.x = s * 0.28;
    }
    function leg(x: number, z: number, long = 0.6) { const p = new T.Group(); p.position.set(x, 0.6, z); body.add(p); mesh(p, cylinder, coat, [0, -0.1, 0], [0.2, long, 0.2]); mesh(p, sphere, dark, [0.08, -long / 2 - 0.1, 0], [0.27, 0.15, 0.23]); legs.push(p); }
    if (id === 'bristleback') {
      mesh(body, sphere, coat, [0, 1.35, 0], [1.65, 1.15, 1.08]); head.position.set(1.3, 1.4, 0);
      mesh(head, sphere, coat, [0, 0, 0], [0.75, 0.73, 0.7]);
      const snout = mesh(head, cylinder, rose, [0.75, -0.18, 0], [0.36, 0.5, 0.36]); snout.rotation.z = -Math.PI / 2;
      for (const s of [-1, 1]) { eye(0.45, 0.14, s * 0.48, s); mesh(head, sphere, ink, [1.02, -0.17, s * 0.13], [0.04, 0.065, 0.05]); const ear = mesh(head, cone, coat, [-0.15, 0.7, s * 0.47], [0.22, 0.5, 0.2]); ear.rotation.x = s * 0.4;
        const curve = new T.CatmullRomCurve3([V(1.8, 1.0, s * 0.5), V(2.15, 1.05, s * 0.58), V(2.25, 1.45, s * 0.56)]); mesh(part, new T.TubeGeometry(curve, 10, 0.08, 7, false), cream, [0, 0, 0]); }
      for (let i = 0; i < 11; i++) { const t = i / 10, spike = mesh(body, cone, dark, [lerp(1, -1.3, t), 2.4 + Math.sin(t * Math.PI) * 0.1, 0], [0.16, 0.5 + Math.sin(t * Math.PI) * 0.35, 0.18]); spike.rotation.z = 0.6; }
      for (const x of [-1, 1]) for (const z of [-0.65, 0.65]) leg(x, z);
      mesh(body, sphere, dark, [-1.65, 1, 0], [0.3, 0.16, 0.16]);
    } else if (id === 'puffwart') {
      mesh(body, sphere, coat, [0, 1, 0], [1.7, 1.1, 1.4]); head.position.set(0.9, 1.55, 0);
      mesh(head, sphere, coat, [0, 0, 0], [1.0, 0.65, 1.2]);
      rig.throat = mesh(body, sphere, belly, [1.1, 0.9, 0], [0.9, 0.8, 1.05]);
      rig.tongue = mesh(body, cylinder, rose, [1.8, 1.1, 0], [0.12, 0.1, 0.12], false); rig.tongue.rotation.z = -Math.PI / 2; rig.tongue.visible = false;
      for (const s of [-1, 1]) { eye(0.4, 0.25, s * 0.85, s); leg(0.9, s * 1.1, 0.4); leg(-1, s * 1.2, 0.4); }
      // The warts stay on; the pop-off part is the throat sac, which deflates.
      for (let i = 0; i < 13; i++) { const a = i * 2.4; mesh(body, sphere, toon(0xb4aa5c), [Math.cos(a) * 1.1, 1.7 + Math.sin(i) * 0.2, Math.sin(a) * 0.85], [0.22, 0.18, 0.22]); }
    } else if (id === 'skreel') {
      mesh(body, sphere, coat, [0, 1.4, 0], [1.1, 1.4, 1]); mesh(body, sphere, belly, [0.7, 1.2, 0], [0.55, 1.03, 0.8]); head.position.set(0.35, 2.1, 0);
      mesh(head, sphere, coat, [0, 0, 0], [0.95, 0.85, 1.0]);
      for (const s of [-1, 1]) { mesh(head, sphere, cream, [0.6, 0, s * 0.47], [0.35, 0.5, 0.4]); eye(0.8, 0.05, s * 0.5, s);
        const wing = new T.Group(); wing.position.set(-0.15, 1.8, s * 0.85); body.add(wing); const m = mesh(wing, sphere, coat, [-0.15, -0.55, s * 0.25], [0.5, 1.0, 0.32]); m.rotation.x = -s * 0.2; wings.push(wing); leg(0.25, s * 0.5, 0.35);
        mesh(part, cone, coat, [-0.2, 2.95, s * 0.5], [0.3, 0.55, 0.25]); }
      const beak = mesh(head, cone, gold, [1, -0.08, 0], [0.23, 0.45, 0.22]); beak.rotation.z = -Math.PI / 2;
      for (let i = -1; i <= 1; i++) mesh(body, sphere, coat, [-1.03, 0.75, i * 0.32], [0.75, 0.2, 0.25]);
    } else if (id === 'hornclack') {
      mesh(body, sphere, dark, [0, 1.1, 0], [1.7, 1.1, 1.35]);
      for (let i = 0; i < 3; i++) mesh(body, sphere, coat, [-0.9 + i * 0.75, 1.35, 0], [0.78, 1.0, 1.32]);
      head.position.set(1.4, 1.05, 0); mesh(head, sphere, coat, [0, 0, 0], [0.65, 0.65, 0.8]);
      for (const s of [-1, 1]) { eye(0.4, 0.02, s * 0.58, s); for (const x of [-1.05, 0, 1.05]) leg(x, s * 1.15, 0.5); }
      const horn = mesh(part, cone, cream, [1.7, 2, 0], [0.4, 1.8, 0.4]); horn.rotation.z = -0.4;
    } else {
      mesh(body, sphere, coat, [-0.15, 1.4, 0], [1.65, 0.95, 0.9]); head.position.set(1.15, 2, 0);
      mesh(head, sphere, coat, [0, 0, 0], [0.8, 0.8, 0.85]); mesh(head, sphere, cream, [0.65, -0.25, 0], [0.35, 0.28, 0.5]); mesh(head, sphere, rose, [0.91, -0.1, 0], [0.1, 0.1, 0.17]);
      rig.mane = new T.Group(); body.add(rig.mane);
      for (let i = 0; i < 13; i++) { const a = i / 13 * Math.PI * 2, m = mesh(rig.mane, ico, toon(i % 2 ? 0xa5cde7 : 0xc7e3ef), [0.72, 1.8 + Math.cos(a) * 0.72, Math.sin(a) * 0.8], [0.65, 0.5, 0.45]); m.rotation.x = a; }
      for (const s of [-1, 1]) { eye(0.5, 0.1, s * 0.6, s); const ear = mesh(head, cone, coat, [-0.15, 0.9, s * 0.55], [0.25, 0.7, 0.24]); ear.rotation.x = s * 0.2; mesh(part, cone, dark, [0.9, 3.25, s * 0.55], [0.075, 0.4, 0.075]); for (const x of [-1, 1]) leg(x, s * 0.65, 1); }
      const curve = new T.CatmullRomCurve3([V(-1.4, 1.4, 0), V(-2, 1.6, 0.2), V(-2.5, 2.2, 0.3), V(-2.35, 2.7, 0.3)]); mesh(body, new T.TubeGeometry(curve, 12, 0.32, 8, false), toon(0xb5d4e9), [0, 0, 0]);
    }
    // Steam puffs over each ear, in head space; only shown while Extra Grumpy.
    const ear = { bristleback: [-0.15, 1, 0.5], puffwart: [0, 0.65, 0.8], skreel: [0, 0.85, 0.5], hornclack: [0, 0.6, 0.55], frostmane: [-0.15, 1.3, 0.55] }[id];
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) { const puff = mesh(head, sphere, steamMat, [ear[0], ear[1], ear[2] * side], [0.14, 0.14, 0.14], false); puff.visible = false; rig.steam.push(puff); }
    root.visible = false; return rig;
  }
  const beasts = Object.fromEntries(BEAST_IDS.map((id) => [id, beastRig(id)])) as Record<BeastId, BeastRig>;
  const markerMat = noOutline(new T.MeshBasicMaterial({ color: 0xf39a31, transparent: true, opacity: 0.5, side: T.DoubleSide, depthWrite: false })); materials.add(markerMat);
  const lane = mesh(scene, plane, markerMat, [0, 0.07, 0], [1, 1, 1], false); lane.rotation.x = -Math.PI / 2;
  const circleGeo = new T.CircleGeometry(1, 40); circleGeo.rotateX(-Math.PI / 2);
  const circle = mesh(scene, circleGeo, markerMat, [0, 0.08, 0], [1, 1, 1], false);
  const icyGeo = new T.RingGeometry(0.9, 1, 40); icyGeo.rotateX(-Math.PI / 2);
  const icyMat = noOutline(new T.MeshBasicMaterial({ color: 0xb5dff5, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false }));
  const icyRing = mesh(scene, icyGeo, icyMat, [0, 0.09, 0], [1, 1, 1], false);
  const cloudMat = noOutline(new T.MeshBasicMaterial({ color: 0xd0bfe3, transparent: true, opacity: 0.35, depthWrite: false })); materials.add(cloudMat);
  const cloudPool = Array.from({ length: 6 }, () => mesh(scene, sphere, cloudMat, [0, 0, 0], [1, 1, 1], false));
  const starGeo = new T.OctahedronGeometry(0.14), starMat = toon(0xffd35d, undefined, false);
  const stars = Array.from({ length: 3 }, () => mesh(scene, starGeo, starMat, [0, 0, 0], [1, 1, 1], false));
  const shotMat = toon(0xffd35d, undefined, false), shotPool = Array.from({ length: 20 }, () => mesh(scene, sphere, shotMat, [0, 0, 0], [0.09, 0.09, 0.09], false));
  const dropMat = toon(0xeab95c), dropPool = Array.from({ length: 24 }, () => mesh(scene, ico, dropMat, [0, 0, 0], [0.18, 0.22, 0.18], false));
  const fxMat = noOutline(new T.MeshBasicMaterial({ color: 0xf3db9a, transparent: true, opacity: 0.65, depthWrite: false })); materials.add(fxMat);
  const fxPool = Array.from({ length: 48 }, () => mesh(scene, ico, fxMat, [0, 0, 0], [1, 1, 1], false));
  // Dropped materials float as their painted icons once the sheet has loaded; the gold gems stand in until then.
  const iconMaps: Partial<Record<MaterialId, T.Texture>> = {};
  const iconSheet = loader.load('/art/hunt/icons-materials.webp', (sheet) => {
    if (closed) { sheet.dispose(); return; }
    for (const id of MATERIAL_IDS) {
      const cell = MATERIALS[id].icon, map = sheet.clone(); map.repeat.set(0.25, 0.25); map.offset.set((cell % 4) * 0.25, 0.75 - Math.floor(cell / 4) * 0.25); map.needsUpdate = true; textures.add(map); iconMaps[id] = map;
    }
  }, undefined, () => { /* The gold gems remain. */ });
  iconSheet.colorSpace = T.SRGBColorSpace; textures.add(iconSheet);
  const dropSprites = Array.from({ length: 24 }, () => {
    const m = noOutline(new T.SpriteMaterial({ transparent: true, alphaTest: 0.2, depthWrite: false })); materials.add(m);
    const sprite = new T.Sprite(m); sprite.scale.setScalar(0.8); sprite.visible = false; scene.add(sprite); return sprite;
  });
  // Gathering: a soft cream ring marks the spot in reach and fills while you gather.
  const reachGeo = new T.RingGeometry(1.05, 1.25, 36); reachGeo.rotateX(-Math.PI / 2);
  const reachMat = noOutline(new T.MeshBasicMaterial({ color: 0xfff4cf, transparent: true, opacity: 0.6, side: T.DoubleSide, depthWrite: false })); materials.add(reachMat);
  const reach = mesh(scene, reachGeo, reachMat, [0, 0.06, 0], [1, 1, 1], false);
  const fillMat = noOutline(new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.45, side: T.DoubleSide, depthWrite: false })); materials.add(fillMat);
  const fill = mesh(scene, circleGeo, fillMat, [0, 0.065, 0], [1, 1, 1], false);
  // Sticky sap: an amber puddle on the ground, and the same puddle under a stuck beast.
  const sapMat = noOutline(new T.MeshToonMaterial({ color: 0xe39a2c, gradientMap: ramp, transparent: true, opacity: 0.85, depthWrite: false })); materials.add(sapMat);
  const sap = mesh(scene, circleGeo, sapMat, [0, 0.07, 0], [0.8, 1, 0.8], false);
  const sapBlobs = Array.from({ length: 4 }, (_, i) => mesh(scene, sphere, sapMat, [0, 0, 0], [0.22 - i * 0.03, 0.08, 0.22 - i * 0.03], false));
  // Smoke puffball: grey puffs swirl round a hidden leader. Sleepy seed: lavender puffs drift up from a drowsy beast.
  const smokeMat = noOutline(new T.MeshBasicMaterial({ color: 0x9c968f, transparent: true, opacity: 0.72, depthWrite: false })); materials.add(smokeMat);
  const smoke = Array.from({ length: 10 }, () => mesh(scene, sphere, smokeMat, [0, 0, 0], [0.4, 0.4, 0.4], false));
  const drowsyMat = noOutline(new T.MeshBasicMaterial({ color: 0xb8a6ea, transparent: true, opacity: 0.8, depthWrite: false })); materials.add(drowsyMat);
  const drowsy = Array.from({ length: 3 }, () => mesh(scene, sphere, drowsyMat, [0, 0, 0], [0.15, 0.15, 0.15], false));
  // Enzo's sniff trail: one instanced draw of glowing pawprint cards lying on the grass.
  const pawCanvas = document.createElement('canvas'); pawCanvas.width = pawCanvas.height = 64;
  const pc = pawCanvas.getContext('2d');
  if (pc) {
    // A soft halo first, then the print itself, so it reads as glowing on bright grass.
    pc.fillStyle = '#fff'; pc.shadowColor = '#ffd25a'; pc.shadowBlur = 9;
    for (let pass = 0; pass < 2; pass++) {
      pc.beginPath(); pc.ellipse(32, 41, 12, 10, 0, 0, Math.PI * 2); pc.fill();
      for (const [x, y, r] of [[16, 24, 5.5], [26, 16, 6], [38, 16, 6], [48, 24, 5.5]]) { pc.beginPath(); pc.arc(x, y, r, 0, Math.PI * 2); pc.fill(); }
    }
  }
  const pawMap = new T.CanvasTexture(pawCanvas); pawMap.colorSpace = T.SRGBColorSpace; textures.add(pawMap);
  const pawMat = noOutline(new T.MeshBasicMaterial({ color: 0xfff1b0, map: pawMap, transparent: true, opacity: 1, depthWrite: false, toneMapped: false })); materials.add(pawMat);
  const pawGeo = new T.PlaneGeometry(0.9, 0.9); pawGeo.rotateX(-Math.PI / 2); geometries.add(pawGeo);
  const pawprints = new T.InstancedMesh(pawGeo, pawMat, 16); pawprints.count = 0; pawprints.frustumCulled = false; scene.add(pawprints);
  function poseActor(id: HeroId, game: HuntGame) {
    const a = actors[id], isPlayer = id === game.heroId, p = isPlayer ? game.hero : game.buddy, h = game.hero;
    const time = reduced.matches ? 0 : preview ? showTime : game.time;
    const riding = isPlayer && game.ride.riding;
    let height = 0;
    if (riding && game.beast) height = game.beast.height + RIDE_HEIGHT[game.beast.id];
    else if (isPlayer && game.vault > 0) height = Math.sin(game.vault / 0.8 * Math.PI) * (game.perk('air-bonk') ? 1.5 : 1);
    a.model.root.position.set(p.x, height, p.z); a.model.root.rotation.y = p.face;
    if (isPlayer && game.ride.landing > 0 && !reduced.matches) { const f = 1 - game.ride.landing / 0.6; a.model.root.position.y = (1 - f) * (game.beast ? RIDE_HEIGHT[game.beast.id] : 2) + Math.sin(f * Math.PI) * 0.7; if (game.beast) { a.model.root.position.x = lerp(game.beast.x, p.x, f); a.model.root.position.z = lerp(game.beast.z, p.z, f); } }
    animateHuntChinchilla(a.model, time, p.speed / 5, true);
    if (isPlayer && h.roll >= 0 && !reduced.matches) { a.model.body.rotation.z = -h.roll / 0.46 * Math.PI * 2; a.model.root.position.y = Math.sin(h.roll / 0.46 * Math.PI) * 0.3; }
    // A little item-use nod can finish sooner with Deep Breath, without delaying another item.
    else a.model.body.rotation.z = isPlayer && h.swing < 0 && !reduced.matches ? Math.min(0.12, game.itemRecovery * 0.4) : 0;
    a.model.feet.forEach((foot, i) => { foot.rotation.x = riding ? (i ? -0.5 : 0.5) : 0; if (riding) foot.position.y = 0.14; });
    if (riding) { a.model.body.scale.y *= 0.85; a.model.body.rotation.z = game.ride.pose > 0 && !reduced.matches ? Math.sin(game.ride.pose / 0.22 * Math.PI) * -0.2 : 0; }
    const t = isPlayer && game.ride.riding && game.ride.pose > 0 ? 0.24 - game.ride.pose : preview ? showSwing() : p.swing;
    const weapon = game.weapon(id);
    a.hammer.visible = weapon === 'hammer'; a.trail.visible = false;
    a.armour.forEach((g, i) => { const piece = game.profile.armour.worn[(['helm', 'vest', 'boots'] as const)[i]]; g.visible = isPlayer && !!piece; if (piece) { const color = BEASTS[piece.split('-')[0] as BeastId].color; g.traverse((o) => { if (o instanceof T.Mesh) (o.material as T.MeshToonMaterial).color.set(color); }); } });
    a.weapons.pose(weapon, time, t);
    if (weapon === 'hammer') {
      a.hammer.rotation.z = t < 0 ? 0.9 : t < 0.15 ? lerp(0.9, 2.1, t / 0.15) : t < 0.25 ? lerp(2.1, -2, (t - 0.15) / 0.1) : lerp(-2, 0.9, Math.min(1, (t - 0.25) / 0.3) ** 2);
      if (isPlayer && h.charge > 0) a.hammer.rotation.z = 1.9 + Math.sin(time * 18) * Math.min(0.05, h.charge * 0.05);
      a.hammer.updateMatrix();
      const both = t >= 0.12 && t < 0.42 ? 1 : t >= 0.06 && t < 0.12 ? (t - 0.06) / 0.06 : t >= 0.42 && t < 0.5 ? 1 - (t - 0.42) / 0.08 : 0;
      poseArms(a.model, V(0, 0.26, 0).applyMatrix4(a.hammer.matrix), V(0, 0.1, 0).applyMatrix4(a.hammer.matrix), [isPlayer && (h.charge > 0 || game.ride.riding) ? 1 : both, 1]);
      a.model.root.updateMatrixWorld(true);
      if (t >= 0.12 && t < 0.35 && !reduced.matches) { a.points.unshift(a.head.getWorldPosition(V())); if (a.points.length > 10) a.points.pop(); }
      else a.points.length = 0;
      a.trail.visible = a.points.length > 1;
      if (a.trail.visible) { const attr = a.trail.geometry.getAttribute('position'); for (let i = 0; i < 10; i++) { const p = a.points[Math.min(i, a.points.length - 1)]; attr.setXYZ(i, p.x, p.y, p.z); } attr.needsUpdate = true; a.trail.geometry.computeBoundingSphere(); }
    }
  }
  const hopRing = mesh(scene, reachGeo, reachMat, [0, 0.1, 0], [1, 1, 1], false);
  function label(text: string, color: string) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const ctx = c.getContext('2d'); if (ctx) { ctx.font = 'bold 58px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.fillText(text, 128, 70); }
    const map = new T.CanvasTexture(c); textures.add(map);
    const mat = noOutline(new T.SpriteMaterial({ map, transparent: true, depthWrite: false })); materials.add(mat);
    const sprite = new T.Sprite(mat); sprite.scale.set(1.8, 0.7, 1); scene.add(sprite); return sprite;
  }
  const hopLabel = label('hop!', '#fff4cf'), shakeMark = label('〰!', '#f39a31');
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  function resize() { if (closed) return; const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ray = new T.Raycaster(), cameraAim = V(), desired = V(), segment = V();
  let lastRide = { riding: false, fullBonks: 0, bucking: false };
  // The rack and Forge preview: the hero on a little grass stand, swaying slowly and swinging the weapon every few seconds.
  const showBg = new T.Color(0xf6ead2), stand = new T.Group(); let showTime = 0; stand.visible = false; scene.add(stand);
  if (preview) { mesh(stand, new T.CylinderGeometry(1.2, 1.1, 0.22, 32), toon(0x9a6b44), [0, -0.12, 0], [1, 1, 1], false); mesh(stand, new T.CylinderGeometry(1.22, 1.22, 0.06, 32), toon(0x8cc152), [0, -0.02, 0], [1, 1, 1], false); }
  const showSwing = () => { const c = showTime % 3.2; return !reduced.matches && c >= 2 && c < 2.6 ? c - 2 : -1; };
  function draw(game: HuntGame, dt: number) {
    lastRide = { riding: game.ride.riding, fullBonks: game.ride.fullBonks, bucking: game.ride.riding && game.ride.phase !== 'quiet' };
    if (closed) return;
    const worldKey = `${game.profile.hunts}:${game.mode === 'village' || game.mode === 'camp'}`;
    if (worldKey !== currentWorld) { currentWorld = worldKey; buildWorld(game); }
    village.visible = paths.visible = game.mode === 'village' || game.mode === 'camp'; campPath.visible = !village.visible;
    poseActor('dora', game); poseActor('enzo', game);
    for (const id of BEAST_IDS) beasts[id].root.visible = game.beast?.id === id && !['village', 'camp'].includes(game.mode);
    const b = game.beast;
    const rock = game.hopRock();
    hopRing.visible = hopLabel.visible = !!rock;
    if (rock) { hopRing.position.set(rock.x, 0.12, rock.z); hopRing.scale.set(rock.r + 0.4, 1, rock.r + 0.4); hopLabel.position.set(rock.x, 1.6, rock.z); }
    shakeMark.visible = !!b && game.ride.riding && game.ride.phase !== 'quiet';
    if (b) shakeMark.position.set(b.x, b.height + 3.4, b.z);
    if (b) {
      const r = beasts[b.id], motion = reduced.matches ? 0 : Math.sin(game.time * 8);
      r.root.position.set(b.x, b.height, b.z); r.root.rotation.y = b.face;
      const napping = b.state === 'nap', nap = napping ? Math.min(1, b.t / 1.6) : 0;
      r.body.rotation.z = napping ? nap * 0.28 : b.state === 'windup' ? -0.12 * Math.sin(b.t * 12) : b.state === 'dizzy' ? Math.sin(game.time * 4) * 0.07 : b.state === 'stuck' && !reduced.matches ? Math.sin(game.time * 11) * 0.05 : 0;
      r.body.rotation.x = game.ride.plopped > 0 ? 1.25 * Math.min(1, (2 - game.ride.plopped) / 0.25, game.ride.plopped / 0.35) : 0;
      if (game.ride.riding && game.ride.phase === 'buck' && !reduced.matches) r.body.rotation.z = Math.sin(game.time * 22) * 0.3;
      r.body.rotation.y = b.state === 'sweep' ? Math.sin(Math.min(1, b.t / Math.max(0.01, b.duration)) * Math.PI) * 1.35 : 0;
      const pulse = b.flash > 0 ? Math.sin(b.flash * 25) * 0.08 : 0;
      const gone = napping ? 1 - T.MathUtils.smoothstep(b.t, 2.7, 3.2) : 1;
      r.root.scale.setScalar(Math.max(0.001, gone)); r.body.scale.set(1 + nap * 0.12 + pulse, 1 - nap * 0.42 - pulse, 1 + nap * 0.16 + pulse);
      if (game.ride.riding && game.ride.phase === 'warning') { r.body.scale.y *= 0.86; r.body.scale.x *= 1.06; }
      r.legs.forEach((leg, i) => { leg.rotation.z = nap * -0.9 + (!napping && ['roam', 'charge', 'pounce', 'hop'].includes(b.state) ? motion * (i % 2 ? 0.3 : -0.3) : 0); });
      if (b.id === 'bristleback' && b.state === 'windup' && !reduced.matches) r.legs[2].rotation.z = Math.sin(game.time * 16) * 0.55;
      r.eyes.forEach((eye) => { eye.scale.y = nap > 0 ? Math.max(0.02, 0.15 * (1 - nap)) : 0.12; });
      r.part.visible = !b.broken;
      r.wings.forEach((wing, i) => { wing.rotation.x = b.state === 'circle' || b.state === 'swoop' ? Math.sin(game.time * 9) * (i ? -0.9 : 0.9) : 0; });
      if (r.throat) { const sac = b.broken ? 0.72 : 1; r.throat.scale.set((0.9 + (b.attack === 'cloud' && b.state === 'windup' ? b.t * 0.5 : Math.sin(game.time * 2) * 0.035)) * sac, 0.8 * sac, 1.05 * sac); }
      if (r.tongue) { r.tongue.visible = b.state === 'tongue'; const length = 0.1 + Math.sin(Math.min(1, b.t / Math.max(0.01, b.duration)) * Math.PI) * 5.4; r.tongue.scale.y = length; r.tongue.position.x = 1.4 + length / 2; }
      if (r.mane) { r.mane.rotation.x = b.state === 'shake' ? Math.sin(game.time * 30) * 0.22 : 0; r.mane.scale.setScalar(1 + (b.phase - 1) * 0.08); }
      const steaming = b.grumpy && !napping;
      r.brow.color.copy(steaming ? grumpyRed : r.browColor);
      r.steam.forEach((puff, i) => {
        puff.visible = steaming; if (!steaming) return;
        // Each puff rises, swells and vanishes in a 1.2 s loop, staggered across the three per ear.
        const f = reduced.matches ? 0.35 + (i % 3) * 0.2 : (game.time / 1.2 + (i % 3) / 3) % 1, home = puff.userData.home ??= puff.position.clone();
        puff.position.set(home.x - f * 0.2, home.y + f * 0.9, home.z * (1 + f * 0.3)); puff.scale.setScalar((0.08 + f * 0.17) * Math.min(1, (1 - f) * 4));
      });
    }
    const warning = b?.state === 'windup';
    const round = b && ['sweep', 'shake', 'cloud'].includes(b.attack);
    lane.visible = !!warning && !round; circle.visible = !!warning && !!round;
    icyRing.visible = b?.state === 'shake'; if (b) { const size = 1 + Math.min(1, b.t / Math.max(0.01, b.duration)) * 4; icyRing.position.set(b.x, 0.09, b.z); icyRing.scale.set(size, 1, size); }
    markerMat.opacity = reduced.matches ? 0.48 : 0.3 + Math.sin(game.time * 13) * 0.12 + 0.1;
    if (b && warning) {
      if (round) { const size = b.attack === 'shake' ? 5 : b.attack === 'cloud' ? 3.5 : 4; circle.position.set(b.x + (b.attack === 'cloud' ? b.dir.x * 3 : 0), 0.08, b.z + (b.attack === 'cloud' ? b.dir.z * 3 : 0)); circle.scale.set(size, 1, size); }
      else { const length = Math.hypot(b.aim.x - b.start.x, b.aim.z - b.start.z); lane.position.set((b.start.x + b.aim.x) / 2, 0.08, (b.start.z + b.aim.z) / 2); lane.scale.set(b.attack === 'tongue' ? 2.4 : b.attack === 'hop' || b.attack === 'pounce' ? 6 : 5, Math.max(1, length), 1); lane.rotation.set(-Math.PI / 2, 0, -Math.atan2(b.aim.x - b.start.x, b.aim.z - b.start.z)); }
    }
    const prints = game.trail(), glow = Math.min(1, game.sniff / 1.5);
    pawprints.count = prints.length; pawMat.opacity = glow;
    prints.forEach((p, i) => {
      // A soft wave of brightness travels along the trail towards the beast.
      const wave = reduced.matches ? 1 : 0.8 + 0.25 * Math.max(0, Math.sin(game.time * 5 - i * 0.7));
      quat.setFromAxisAngle(V(0, 1, 0), p.face - Math.PI / 2); matrix.compose(V(p.x, 0.06, p.z), quat, V(wave, 1, wave)); pawprints.setMatrixAt(i, matrix);
    });
    pawprints.instanceMatrix.needsUpdate = true;
    cloudPool.forEach((o, i) => { const c = game.clouds[i]; o.visible = !!c; if (c) { o.position.set(c.x, 0.5, c.z); o.scale.set(c.r, 0.6, c.r); } });
    stars.forEach((s, i) => { s.visible = !!b && b.state === 'dizzy'; if (b) { const a = game.time * 3 + i * Math.PI * 2 / 3; s.position.set(b.x + Math.cos(a), b.height + 3.2, b.z + Math.sin(a)); s.rotation.y = a; } });
    shotPool.forEach((o, i) => { const s = game.shots[i]; o.visible = !!s; if (s) { o.position.set(s.x, 0.85, s.z); o.scale.setScalar(s.heavy ? 0.18 : 0.1); } });
    dropPool.forEach((o, i) => { const d = game.drops[i]; o.visible = !!d && !iconMaps[d.material]; if (d) { o.position.set(d.x, 0.4 + Math.sin(game.time * 3 + d.id) * 0.08, d.z); o.rotation.y = game.time; } });
    dropSprites.forEach((o, i) => { const d = game.drops[i], map = d && iconMaps[d.material]; o.visible = !!map; if (d && map) { if (o.material.map !== map) { o.material.map = map; o.material.needsUpdate = true; } o.position.set(d.x, 0.65 + (reduced.matches ? 0 : Math.sin(game.time * 3 + d.id) * 0.08), d.z); } });
    const hunting = game.mode === 'hunt' || game.mode === 'nap';
    for (const rig of spotRigs) {
      const spot = game.spots.find((s) => s.id === rig.id); rig.root.visible = hunting && !!spot;
      rig.fruit.visible = !!spot && !spot.done;
      if (rig.material === 'glimmer-stone' && !reduced.matches) rig.fruit.rotation.y = game.time * 0.8;
    }
    const near = game.nearestGather(), busy = game.gathering ? game.spots.find((s) => s.id === game.gathering!.spot) : null, marked = busy ?? near;
    reach.visible = !!marked; fill.visible = !!busy;
    if (marked) { reach.position.set(marked.x, 0.06, marked.z); reachMat.opacity = reduced.matches ? 0.6 : 0.45 + Math.sin(game.time * 5) * 0.15; }
    if (busy && game.gathering) { const f = Math.min(1, game.gathering.t / GATHER_TIME) * 1.1; fill.position.set(busy.x, 0.065, busy.z); fill.scale.set(Math.max(0.01, f), 1, Math.max(0.01, f)); }
    const stuck = b?.state === 'stuck', puddle = stuck ? b! : game.trap;
    sap.visible = !!puddle; if (puddle) { sap.position.set(puddle.x, 0.07, puddle.z); sap.scale.set(stuck ? 2.3 : 0.8, 1, stuck ? 2.3 : 0.8); }
    sapBlobs.forEach((o, i) => { o.visible = !!game.trap || stuck; const at = stuck ? b! : game.trap; if (at) { const a = i * 1.7; o.position.set(at.x + Math.cos(a) * (stuck ? 1.2 : 0.45), 0.08, at.z + Math.sin(a) * (stuck ? 1.2 : 0.45)); o.scale.set(stuck ? 0.6 : 0.2, 0.1, stuck ? 0.6 : 0.2); } });
    const hidden = game.hero.hidden > 0 && game.mode === 'hunt', fade = Math.min(1, game.hero.hidden);
    smoke.forEach((o, i) => { o.visible = hidden; if (hidden) { const a = i / 10 * Math.PI * 2 + (reduced.matches ? 0 : game.time * 1.4), s = (0.6 + 0.15 * Math.sin(game.time * 3 + i)) * fade; o.position.set(game.hero.x + Math.cos(a) * 0.75, 0.4 + (i % 3) * 0.45, game.hero.z + Math.sin(a) * 0.75); o.scale.setScalar(s); } });
    drowsy.forEach((o, i) => { const on = !!b && b.drowsy > 0 && b.state !== 'nap'; o.visible = on; if (on) { const f = reduced.matches ? 0.3 + i * 0.25 : (game.time / 1.8 + i / 3) % 1; o.position.set(b!.x + f * 0.6, b!.height + 3 + f * 1.4, b!.z + Math.sin(f * 6) * 0.3); o.scale.setScalar(0.1 + f * 0.12); } });
    fxPool.forEach((o, i) => { const f = game.fx[Math.floor(i / 4)]; o.visible = !!f && !reduced.matches; if (f) { const a = i * 2.4, t = f.t, s = Math.max(0, 1 - t) * (f.kind === 'bonk' ? 0.16 : 0.25); o.position.set(f.x + Math.cos(a) * t * 1.5, 0.3 + Math.sin(t * Math.PI) * (f.kind === 'bonk' ? 1.4 : 0.6), f.z + Math.sin(a) * t * 1.5); o.scale.setScalar(s); } });
    userOrbit = Math.max(0, userOrbit - dt);
    if (game.locked && b && userOrbit <= 0) { const wanted = Math.atan2(game.hero.x - b.x, game.hero.z - b.z); yaw += Math.atan2(Math.sin(wanted - yaw), Math.cos(wanted - yaw)) * Math.min(1, dt * 2); }
    const h = game.hero;
    // Lift the focus for airborne Skreel so the bird and dizzy stars stay below the HUD.
    cameraAim.set(h.x, 2 + (b?.height ?? 0) * 0.65, h.z);
    if (game.mode === 'village' || game.mode === 'camp') { cameraAim.set(h.x * 0.7, 1.5, h.z * 0.7); }
    target.lerp(cameraAim, Math.min(1, dt * 8));
    const mobile = camera.aspect < 0.85, distance = dist + (mobile ? 1.6 : 0);
    desired.set(target.x + Math.sin(yaw) * distance * Math.cos(pitch), target.y + Math.sin(pitch) * distance, target.z + Math.cos(yaw) * distance * Math.cos(pitch));
    segment.copy(desired).sub(target); const length = segment.length(); ray.set(target, segment.normalize()); ray.far = length;
    const hits = ray.intersectObjects(blockers.filter((o) => { for (let p: T.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true; }), false);
    if (hits.length) desired.copy(target).addScaledVector(segment, Math.max(1.7, hits[0].distance - 0.6));
    desired.y = Math.max(0.8, desired.y);
    camera.position.copy(desired);
    if (!reduced.matches && game.shake > 0) { camera.position.x += Math.sin(game.time * 83) * game.shake * 0.2; camera.position.y += Math.cos(game.time * 71) * game.shake * 0.15; }
    if (preview) {
      showTime += dt; const root = actors[preview].model.root;
      actors.dora.model.root.visible = preview === 'dora'; actors.enzo.model.root.visible = preview === 'enzo';
      // Turned three-quarters so the weapon paw faces the camera.
      root.position.set(0, 0, 0); root.rotation.y = -0.5 + (reduced.matches ? 0 : Math.sin(showTime * 0.7) * 0.35);
      for (const o of scene.children) o.visible = o === root || o === stand || o instanceof T.Light || o === sun.target;
      stand.visible = true; scene.background = showBg; target.set(0, 0.62, 0); camera.position.set(1.9, 1.25, 2.1);
    }
    camera.lookAt(target);
    if (leafCards && crowns) {
      // Shrink away any canopy near the camera or across its view of the leader, so leaves never fill the screen.
      // The camera itself only moves in for trunks and rocks, so it doesn't jump as it passes under trees.
      const sight = segment.copy(target).sub(camera.position), reach = sight.lengthSq();
      canopyPositions.forEach((p, i) => {
        const along = reach > 0 ? Math.max(0, Math.min(1, (p.x - camera.position.x) * sight.x / reach + (p.y - camera.position.y) * sight.y / reach + (p.z - camera.position.z) * sight.z / reach)) : 0;
        const gap = Math.hypot(camera.position.x + sight.x * along - p.x, camera.position.y + sight.y * along - p.y, camera.position.z + sight.z * along - p.z);
        const blocking = camera.position.distanceTo(p) < 4.5 || (along < 0.92 && gap < 2.9);
        const shown = canopyShown[i] = Math.max(0, Math.min(1, canopyShown[i] + (blocking ? -dt : dt) / 0.2));
        matrix.compose(p, camera.quaternion, V(5 * shown, 4.4 * shown, shown)); leafCards!.setMatrixAt(i, matrix);
        matrix.compose(V(p.x, 3.7, p.z), upright, V(1.6 * shown, 1.5 * shown, 1.6 * shown)); crowns!.setMatrixAt(i, matrix);
      });
      leafCards.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
    }
    wind.value = reduced.matches ? 0 : game.time;
    renderer.info.reset();
    outline.render(scene, camera);
    if (++frame === 2) ready();
  }
  return {
    draw,
    get yaw() { return yaw; },
    orbit(dx: number, dy: number) { yaw -= dx * 0.006; pitch = T.MathUtils.clamp(pitch + dy * 0.004, 0.18, 0.95); userOrbit = 4; },
    zoom(delta: number) { dist = T.MathUtils.clamp(dist + delta * 0.008, 5, 14); },
    metrics() { return { ride: { riding: lastRide.riding, fullBonks: lastRide.fullBonks, bucking: lastRide.bucking }, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, camera: camera.position.toArray(), pixelRatio: renderer.getPixelRatio(), textures: renderer.info.memory.textures, hiddenCanopies: canopyShown.filter((v) => v < 0.5).length, pawprints: pawprints.count, spots: spotRigs.filter((r) => r.root.visible && r.fruit.visible).length, drops: dropSprites.filter((o) => o.visible).length, trap: sap.visible, smoke: smoke[0].visible, steam: BEAST_IDS.some((id) => beasts[id].root.visible && beasts[id].steam[0].visible) }; },
    dispose() {
      if (closed) return; closed = true; observer.disconnect();
      scene.traverse((o) => { if (o instanceof T.InstancedMesh) o.dispose(); if (o instanceof T.Mesh || o instanceof T.Line) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
      for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of textures) t.dispose();
      sun.shadow.map?.dispose(); renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss(); scene.clear();
    },
  };
}
export type HuntScene = ReturnType<typeof createHuntScene>;
