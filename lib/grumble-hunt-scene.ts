import * as T from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createHuntChinchilla, animateHuntChinchilla, poseArms, type HuntChinchilla } from './hunt-chinchilla';
import { BEASTS, BEAST_IDS, VARIANT_COLORS, GATHER_TIME, ROAR_REACH, TURF_REACH, type WeatherKind, MATERIAL_IDS, SPOTS, VILLAGERS, type BeastId, type SpotId, type HuntGame, type HeroId, type MaterialId } from './grumble-hunt-game';
import { createHuntWeapons, decorateHuntWeapon } from './grumble-hunt-weapons';
import { createVillager, type VillagerId, type VillagerRig } from './grumble-hunt-villagers';
import { MATERIALS } from './grumble-hunt-content';

type Rig = { model: HuntChinchilla; hammer: T.Group; head: T.Group; trail: T.Line; points: T.Vector3[]; weapons: ReturnType<typeof createHuntWeapons>; hammerLook: ReturnType<typeof decorateHuntWeapon>; armour: T.Group[] };
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
  const scene = new T.Scene(); scene.background = new T.Color(0xb7d9ee); scene.fog = new T.Fog(0xc8dfd2, 22, 86);
  const camera = new T.PerspectiveCamera(64, 1, 0.15, 180);
  const target = V(0, 1.5, 4);
  let yaw = 0, pitch = 0.4, dist = 8.8, userOrbit = 0, closed = false, currentWorld = '', currentArea = 'meadow', frame = 0;
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
  // Beast coats and villagers: lit from above (the back brighter, the belly side shaded), with a soft warm rim so they read as round.
  const fluffy = <M extends T.MeshToonMaterial>(m: M, rim = 0.4) => {
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = 'varying float vUp;\n' + shader.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvUp = normalize(mat3(modelMatrix) * objectNormal).y;');
      shader.fragmentShader = 'varying float vUp;\n' + shader.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= 0.8 + 0.28 * smoothstep(-0.7, 0.8, vUp);')
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>\ngl_FragColor.rgb += vec3(1.0, 0.95, 0.86) * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.5) * ${rim.toFixed(2)};`);
    };
    m.customProgramCacheKey = () => `fluffy${rim}`; return m;
  };
  function texture(name: string, repeat = 1) {
    const t = loader.load(`/art/hunt/${name}.webp`, (loaded) => { if (closed || !textures.has(loaded)) loaded.dispose(); }, undefined, () => { if (!closed) failed('Some paintings could not load. The meadow is still playable. Reload to try them again.'); });
    t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textures.add(t); return t;
  }
  const grassMap = texture('tex-meadow-grass', 32), dirtMap = texture('tex-meadow-dirt', 5), bark = texture('tex-bark', 2), rock = texture('tex-rock', 2), fur = texture('tex-boar-fur', 3);
  const leaf = texture('leaf-cluster'), tuft = texture('grass-tuft');
  leaf.wrapS = leaf.wrapT = tuft.wrapS = tuft.wrapT = T.ClampToEdgeWrapping;
  const sky = loader.load('/art/hunt/sky-meadow.webp', (t) => { if (closed) t.dispose(); else if (currentArea === 'meadow' || currentArea === 'paddock') { t.mapping = T.EquirectangularReflectionMapping; t.colorSpace = T.SRGBColorSpace; scene.background = t; } }, undefined, () => { if (!closed) failed('The sky painting is taking a nap. You can still play.'); });
  textures.add(sky);
  const skyLight = new T.HemisphereLight(0xeaf6ff, 0x7c9d55, 1.4); scene.add(skyLight);
  const sun = new T.DirectionalLight(0xfff1da, 1.8); sun.position.set(12, 22, 14); sun.castShadow = true; sun.shadow.mapSize.setScalar(phone ? 512 : 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 }); sun.shadow.normalBias = 0.05; scene.add(sun, sun.target);
  const sphere = new T.SphereGeometry(1, 16, 12), ico = new T.IcosahedronGeometry(1, 1), cube = new T.BoxGeometry(1, 1, 1);
  const cylinder = new T.CylinderGeometry(1, 1, 1, 12), cone = new T.ConeGeometry(1, 1, 8), plane = new T.PlaneGeometry(1, 1);
  for (const g of [sphere, ico, cube, cylinder, cone, plane]) geometries.add(g);
  function mesh(parent: T.Object3D, geo: T.BufferGeometry, mat: T.Material, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], shadow = true) {
    const m = new T.Mesh(geo, mat); m.position.set(...pos); m.scale.set(...scale); if (!geo.boundingSphere) geo.computeBoundingSphere(); m.castShadow = shadow && (geo.boundingSphere?.radius ?? 1) * Math.max(...scale) > 0.22; m.receiveShadow = true; parent.add(m); geometries.add(geo); materials.add(mat); return m;
  }
  const groundMat = toon(0xd4dfbd, grassMap, false), dirtMat = toon(0xe8d9bd, dirtMap, false);
  // The ground blends a second, rotated and slightly blurred sample of its painting at a larger scale (more of it on the busier grounds) and a slow light-and-dark patchwork, so the tiling doesn't show. The loudest grounds are also muted a little toward grey.
  const calm = { value: 0 }, mute = { value: 0 };
  groundMat.onBeforeCompile = (shader) => {
    shader.uniforms.uCalm = calm; shader.uniforms.uMute = mute;
    shader.vertexShader = 'varying vec2 vGround;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = 'uniform float uCalm, uMute;\nvarying vec2 vGround;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec3 far = texture2D(map, mat2(0.8, -0.6, 0.6, 0.8) * vGround * 0.0305 + 0.37, 1.5).rgb;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * far / max(sampledDiffuseColor.rgb, vec3(0.2)), 0.35 + uCalm);
      float quilt = sin(vGround.x * 0.11 + sin(vGround.y * 0.07) * 2.0) * sin(vGround.y * 0.09 + sin(vGround.x * 0.05) * 1.7);
      diffuseColor.rgb *= 0.95 + 0.09 * quilt;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), uMute);`);
  };
  // Paths fade out at their sides and ends through a wobbly painted alpha edge instead of stopping at a hard line.
  const edge = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const ctx = c.getContext('2d')!, img = ctx.createImageData(64, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
      const wob = 0.08 * Math.sin(y * 0.19) + 0.05 * Math.sin(y * 0.53 + 1.3), u = Math.abs(x / 63 - 0.5) * 2, v = Math.abs(y / 255 - 0.5) * 2;
      const a = (1 - T.MathUtils.smoothstep(u, 0.55 + wob, 0.98 + wob * 0.5)) * (1 - T.MathUtils.smoothstep(v, 0.82, 1)), i = (y * 64 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(a * 255); img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); const t = new T.CanvasTexture(c); textures.add(t); return t;
  })();
  Object.assign(dirtMat, { alphaMap: edge, transparent: true, depthWrite: false });
  // Camp paths are muted a little so the bright dirt painting doesn't read as an orange carpet; in an area they match its ground.
  const pathMute = { value: 0.22 };
  dirtMat.onBeforeCompile = (shader) => {
    shader.uniforms.uMute = pathMute;
    shader.fragmentShader = 'uniform float uMute;\n' + shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), uMute);');
  };
  // A soft dark blob under every tree, rock and gathering spot, so they sit on the ground.
  const blobShade = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d')!, g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(30,26,20,0.55)'); g.addColorStop(0.55, 'rgba(30,26,20,0.3)'); g.addColorStop(1, 'rgba(30,26,20,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; textures.add(t); return t;
  })();
  const contactMat = noOutline(new T.MeshBasicMaterial({ map: blobShade, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); materials.add(contactMat);
  const contactGeo = new T.PlaneGeometry(1, 1); contactGeo.rotateX(-Math.PI / 2); geometries.add(contactGeo);
  const groundGeo = new T.PlaneGeometry(180, 180, 80, 80); groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.getAttribute('position');
  for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = gp.getZ(i), hill = T.MathUtils.smoothstep(Math.hypot(x, z), 22, 65); gp.setY(i, hill * (3 + Math.sin(x * 0.1) * 3 + Math.cos(z * 0.09) * 3)); }
  groundGeo.computeVertexNormals(); mesh(scene, groundGeo, groundMat, [0, 0, 0], [1, 1, 1], false);
  const world = new T.Group(), village = new T.Group(), paths = new T.Group(); scene.add(world, village, paths);
  const canopyPositions: T.Vector3[] = [], blockers: T.Object3D[] = [], spotRigs: SpotRig[] = [];
  let leafCards: T.InstancedMesh | null = null, crowns: T.InstancedMesh | null = null;
  // 1 = a tree's crown and leaf card fully shown, 0 = shrunk away because it would fill the camera's view.
  const canopyShown: number[] = [], upright = new T.Quaternion();
  const barkMat = toon(0xffffff, bark, false), rockMat = toon(0xc7cac0, rock), canopyMat = fluffy(toon(0xffffff, undefined, false), 0.18), foliage = noOutline(new T.MeshToonMaterial({ color: 0xffffff, map: leaf, gradientMap: ramp, alphaTest: 0.35, side: T.DoubleSide })); materials.add(foliage);
  // Trees: a tapered trunk with a root flare and two branch stubs, under a crown of lumpy leaf blobs.
  const trunkGeo = (() => {
    const parts = [new T.CylinderGeometry(0.62, 1, 4, 10, 4), new T.CylinderGeometry(1, 1.7, 0.55, 10)];
    parts[0].translate(0, 2, 0); parts[1].translate(0, 0.27, 0);
    for (const [a, y] of [[0.9, 2.7], [-2.2, 3.1]]) { const b = new T.CylinderGeometry(0.25, 0.4, 1.3, 6); b.rotateZ(0.9); b.rotateY(a); b.translate(Math.cos(a) * 0.55, y, -Math.sin(a) * 0.55); parts.push(b); }
    const merged = mergeGeometries(parts.map((g) => g.toNonIndexed())); parts.forEach((g) => g.dispose()); merged.computeVertexNormals(); return merged;
  })();
  // Welded, so crowns, bushes and manes shade as soft rounded lumps rather than flat facets.
  const blobGeo = (() => {
    const ico = new T.IcosahedronGeometry(1, 2); ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
    const g = mergeVertices(ico), p = g.getAttribute('position'); ico.dispose();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), bump = 1 + 0.07 * Math.sin(x * 5.1 + z * 2.3) + 0.06 * Math.cos(y * 6.2 - x * 3.1) + 0.05 * Math.sin(z * 7.4); p.setXYZ(i, x * bump, y * bump * 0.92, z * bump); }
    g.computeVertexNormals(); return g;
  })();
  // Rocks: a lumpy, flat-bottomed boulder; ice: a cluster of pointed six-sided crystals.
  const rockGeo = (() => {
    const g = new T.IcosahedronGeometry(1, 2), p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), bump = 1 + 0.12 * Math.sin(x * 3.7 + z * 1.9) + 0.09 * Math.cos(y * 4.3 - x * 2.6) + 0.07 * Math.sin(z * 5.1 + y * 3.3); p.setXYZ(i, x * bump, Math.max(y * bump, -0.55), z * bump); }
    const flat = g.toNonIndexed(); g.dispose(); flat.computeVertexNormals(); return flat;
  })();
  const crystalGeo = (() => {
    const parts = [[0, 0, 0, 1.15], [0.32, 0.1, 0.42, 0.75], [-0.38, 0.32, 0.12, 0.62], [0.12, -0.35, -0.3, 0.55]].map(([tz, tx, ox, h]) => {
      const shaft = new T.CylinderGeometry(0.22, 0.26, h, 6), tip = new T.ConeGeometry(0.22, 0.32, 6); tip.translate(0, h / 2 + 0.16, 0);
      const c = mergeGeometries([shaft.toNonIndexed(), tip.toNonIndexed()]); shaft.dispose(); tip.dispose();
      c.translate(0, h / 2, 0); c.rotateZ(tz * 0.9); c.rotateX(tx); c.translate(ox, 0, tx * 0.6); return c;
    });
    const merged = mergeGeometries(parts); parts.forEach((g) => g.dispose()); merged.computeVertexNormals(); return merged;
  })();
  const pondGeo = new T.CylinderGeometry(1, 1, 1, 32);
  const P = (x: number, y: number) => new T.Vector2(x, y);
  // A pine tier: a soft point sweeping out to a drooping, scalloped rim that curls under, instead of a flat-bottomed cone.
  const pineGeo = (() => {
    const g = new T.LatheGeometry([P(0, -0.36), P(0.82, -0.5), P(1, -0.44), P(0.86, -0.22), P(0.5, 0.12), P(0.16, 0.42), P(0, 0.5)], 16), p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), k = 1 + 0.09 * Math.sin(Math.atan2(z, x) * 7) * T.MathUtils.smoothstep(r, 0.4, 0.9); p.setXYZ(i, x * k, p.getY(i) - 0.06 * (k - 1) / 0.09 * T.MathUtils.smoothstep(r, 0.6, 1), z * k); }
    g.computeVertexNormals(); return g;
  })();
  // Hornclack's horn: growth rings around the base, sweeping back towards the head at the tip.
  const hornGeo = (() => {
    const g = new T.LatheGeometry(Array.from({ length: 15 }, (_, i) => { const t = i / 14; return P(Math.pow(1 - t, 0.85) * (1 + (t < 0.65 ? 0.09 * Math.max(0, Math.sin(t * 38)) : 0)), t - 0.5); }), 22), p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const t = p.getY(i) + 0.5; p.setX(i, p.getX(i) - 0.8 * t * t); }
    g.computeVertexNormals(); return g;
  })();
  geometries.add(pineGeo); geometries.add(hornGeo); geometries.add(trunkGeo); geometries.add(blobGeo); geometries.add(rockGeo); geometries.add(crystalGeo); geometries.add(pondGeo);
  /** One crown blob or leaf card per entry, relative to the tree's crown centre. */
  type TreePart = { at: T.Vector3; size: T.Vector3 };
  const treeBlobs: TreePart[][] = [], treeCards: TreePart[][] = [], treeTurn: T.Quaternion[] = [];
  const tuftMat = noOutline(new T.MeshToonMaterial({ color: 0xffffff, map: tuft, gradientMap: ramp, alphaTest: 0.4, side: T.DoubleSide })); materials.add(tuftMat);
  let randomSeed = 61;
  const rnd = () => { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0; return randomSeed / 4294967296; };
  // One instanced draw for grass, no outlines or individual grass objects.
  const blade = new T.BufferGeometry(); blade.setAttribute('position', new T.Float32BufferAttribute([-0.045, 0, 0, 0.045, 0, 0, -0.025, 0.3, 0, 0.025, 0.3, 0, 0, 0.55, 0], 3)); blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]); blade.computeVertexNormals(); geometries.add(blade);
  const grassMat = toon(0x80b445, undefined, false); grassMat.side = T.DoubleSide;
  const wind = { value: 0 };
  // Blades lean away from the two friends (xy, zw of uPush) and the beast (uBeast: x, z, reach), flattening a little as they bend.
  const push = { value: new T.Vector4(0, 99, 0, 99) }, beastPush = { value: new T.Vector3(0, 99, 0) };
  grassMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uWind: wind, uPush: push, uBeast: beastPush });
    shader.vertexShader = 'uniform float uWind; uniform vec4 uPush; uniform vec3 uBeast;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(uWind * 1.8 + instanceMatrix[3].x * .5 + instanceMatrix[3].z * .3) * position.y * position.y * .35;')
      .replace('#include <project_vertex>', `vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
        vec2 base = instanceMatrix[3].xz, lean = vec2(0.0), d;
        d = base - uPush.xy; lean += d / (length(d) + 0.05) * max(0.0, 1.0 - length(d) / 0.8);
        d = base - uPush.zw; lean += d / (length(d) + 0.05) * max(0.0, 1.0 - length(d) / 0.8);
        d = base - uBeast.xy; lean += d / (length(d) + 0.05) * max(0.0, 1.0 - length(d) / uBeast.z);
        float bend = position.y * position.y * 2.2; mvPosition.xz += lean * bend; mvPosition.y -= length(lean) * bend * 0.45;
        mvPosition = modelViewMatrix * mvPosition; gl_Position = projectionMatrix * mvPosition;`);
  };
  const grass = new T.InstancedMesh(blade, grassMat, 8000); grass.receiveShadow = false; scene.add(grass);
  const grassTufts = new T.InstancedMesh(plane, tuftMat, 100); scene.add(grassTufts);
  const matrix = new T.Matrix4(), quat = new T.Quaternion(), tint = new T.Color();
  for (let i = 0; i < 8000; i++) {
    const a = rnd() * 6.283, r = 3 + Math.sqrt(rnd()) * 30, x = Math.cos(a) * r, z = Math.sin(a) * r;
    quat.setFromAxisAngle(V(0, 1, 0), rnd() * 6.283); const s = 0.6 + rnd() * 0.8;
    matrix.compose(V(x, 0.01, z), quat, V(s, s, s)); grass.setMatrixAt(i, matrix); grass.setColorAt(i, tint.setScalar(0.85 + rnd() * 0.3));
  }
  for (let i = 0; i < 100; i++) { const a = rnd() * 6.283, r = 5 + rnd() * 25; quat.setFromAxisAngle(V(0, 1, 0), rnd() * 6.283); matrix.compose(V(Math.cos(a) * r, 0.3, Math.sin(a) * r), quat, V(0.7, 0.6, 0.7)); grassTufts.setMatrixAt(i, matrix); }
  // Two rings of hills in one draw: a near ring and a taller, hazier one peeking over it between them.
  const hillMat = fluffy(toon(0x739d64, undefined, false), 0.12), hills = new T.InstancedMesh(sphere, hillMat, 22); geometries.add(sphere);
  for (let i = 0; i < 22; i++) {
    const far = i >= 11, a = (i % 11 + (far ? 0.5 : 0)) / 11 * Math.PI * 2, r = far ? 78 : 63;
    matrix.compose(V(Math.cos(a) * r, far ? -2 : 0, Math.sin(a) * r), quat.setFromAxisAngle(V(0, 1, 0), -a), far ? V(17, 9 + rnd() * 5, 24) : V(19, 7 + rnd() * 5, 23));
    hills.setMatrixAt(i, matrix); hills.setColorAt(i, tint.setScalar(far ? 1.12 : 0.92 + rnd() * 0.1));
  }
  scene.add(hills);

  const wood = toon(0x9b663b), cream = toon(0xffeac8), gold = toon(0xe6b653), roof = toon(0xb9664d), ink = toon(0x3e3031), rose = toon(0xe9a6a0);
  const berryMat = toon(0xd2344a), hayMat = toon(0xe2c46a), bushMat = fluffy(toon(0x4f8a3c), 0.2), bushLight = fluffy(toon(0x65a04a), 0.2), reedMat = toon(0x7f9f45), cattailMat = toon(0x8a5a35);
  const crystalMat = noOutline(new T.MeshBasicMaterial({ color: 0xffc94a, toneMapped: false })); materials.add(crystalMat);
  // Clover Camp. Each building's walls block the camera; everything else is decoration, moved into one group
  // and instanced by shape and material at the end so the whole camp costs a few dozen draws.
  // Canvas-painted building surfaces: horizontal planks with grain, staggered roof shingles, and speckled plaster.
  function paint(kind: 'planks' | 'shingles' | 'plaster', rx: number, ry: number) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d')!;
    let seed = kind.length * 13; const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 0, 128, 128);
    if (kind === 'planks') for (let row = 0; row < 4; row++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.3})`; ctx.fillRect(0, row * 32 + 3, 128, 26);
      ctx.fillStyle = 'rgba(70,45,25,0.45)'; ctx.fillRect(0, row * 32, 128, 3); ctx.fillRect(((row * 53) % 128), row * 32, 3, 32);
      ctx.strokeStyle = 'rgba(90,60,35,0.18)'; for (let k = 0; k < 4; k++) { ctx.beginPath(); const y = row * 32 + 7 + k * 6 + r() * 3; ctx.moveTo(0, y); ctx.bezierCurveTo(40, y + 2, 80, y - 2, 128, y + 1); ctx.stroke(); }
    }
    if (kind === 'shingles') for (let col = 0; col < 4; col++) for (let k = 0; k < 5; k++) {
      const x = col * 32, y = k * 25.6 + (col % 2) * 12.8;
      for (const oy of [-128, 0]) { ctx.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.35})`; ctx.beginPath(); ctx.ellipse(x + 10, y + oy + 12.8, 22, 12, 0, -Math.PI / 2, Math.PI / 2); ctx.fill(); ctx.strokeStyle = 'rgba(60,30,20,0.4)'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    if (kind === 'plaster') for (let k = 0; k < 500; k++) { ctx.fillStyle = r() < 0.5 ? 'rgba(120,95,60,0.12)' : 'rgba(255,255,255,0.5)'; ctx.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; textures.add(t); return t;
  }
  const plankWall = toon(0x9b663b, paint('planks', 2, 2)), plasterWall = toon(0xffeac8, paint('plaster', 2, 2));
  const shingle = toon(0xb9664d, paint('shingles', 3, 3)), moss = toon(0x6c9778, paint('shingles', 3, 3)), timber = toon(0x6e4423), stone = toon(0xb9b4a6, rock), paper = toon(0xfff6df), steel = toon(0x7c7f86);
  const ember = noOutline(new T.MeshBasicMaterial({ color: 0xffa142, toneMapped: false })), lamp = noOutline(new T.MeshBasicMaterial({ color: 0xffe2a0, toneMapped: false })); materials.add(ember); materials.add(lamp);
  const carrotMat = toon(0xee8a35), leafy = toon(0x6fa84a), sack = toon(0xd9bf8e), skyBlue = toon(0x8cc3d9), plum = toon(0x9a6fb0);
  const gable = new T.ExtrudeGeometry(new T.Shape([new T.Vector2(-0.5, 0), new T.Vector2(0.5, 0), new T.Vector2(0, 1)]), { depth: 1, bevelEnabled: false }); gable.translate(0, 0, -0.5); geometries.add(gable);
  const roundGeo = new T.CylinderGeometry(1, 1, 1, 16); roundGeo.rotateX(Math.PI / 2); geometries.add(roundGeo);
  const decor = new T.Group(); village.add(decor);
  type P3 = [number, number, number];
  function part(building: T.Group, geo: T.BufferGeometry, mat: T.Material, pos: P3, scale: P3, rot: P3 = [0, 0, 0]) { const m = mesh(building, geo, mat, pos, scale); m.rotation.set(...rot); return m; }
  /** A cottage: stone footing, walls with corner posts, a door, and a gabled roof facing the path. */
  function cottage(b: T.Group, walls: T.Material, roofMat: T.Material, w: number, d: number, h: number) {
    part(b, cube, stone, [0, 0.22, 0], [w + 0.25, 0.44, d + 0.25]);
    blockers.push(mesh(b, cube, walls, [0, 0.44 + h / 2, 0], [w, h, d]));
    for (const x of [-1, 1]) for (const z of [-1, 1]) part(b, cube, timber, [x * w / 2, 0.44 + h / 2, z * d / 2], [0.18, h, 0.18]);
    part(b, cube, timber, [0, 0.44 + h, d / 2 + 0.01], [w + 0.1, 0.16, 0.12]);
    const top = 0.44 + h, rise = w * 0.42, slope = Math.atan2(rise, w / 2), half = Math.hypot(w / 2, rise) + 0.3;
    part(b, gable, walls, [0, top, 0], [w, rise, d]);
    for (const s of [-1, 1]) part(b, cube, roofMat, [s * (w / 4 + 0.08), top + rise / 2 + 0.1, 0], [half, 0.14, d + 0.55], [0, 0, -s * slope]);
    part(b, cylinder, timber, [0, top + rise + 0.17, 0], [0.09, d + 0.6, 0.09], [Math.PI / 2, 0, 0]);
    part(b, cube, timber, [-0.35, 0.44 + 0.75, d / 2 + 0.03], [0.95, 1.55, 0.06]);
    part(b, cube, ink, [-0.35, 0.44 + 0.7, d / 2 + 0.05], [0.72, 1.4, 0.04]);
    part(b, sphere, gold, [-0.1, 0.44 + 0.72, d / 2 + 0.08], [0.05, 0.05, 0.04]);
    return top;
  }
  const chimneyAt: T.Vector3[] = [];
  for (const s of SPOTS) {
    const building = new T.Group(); village.add(building); building.position.set(s.x, 0, s.z);
    if (s.id === 'forge') {
      // Bramble's forge: a red-roofed workshop with a glowing furnace window, a stone chimney, an anvil and a hammer sign.
      const top = cottage(building, plankWall, shingle, 3.4, 2.5, 1.7);
      part(building, cube, stone, [0.95, 1.35, 1.27], [0.95, 0.8, 0.08]); part(building, cube, ember, [0.95, 1.33, 1.32], [0.68, 0.55, 0.04]);
      for (const x of [0.72, 1.18]) part(building, cube, timber, [x, 1.33, 1.35], [0.06, 0.55, 0.04]);
      part(building, cylinder, stone, [-1.05, top + 0.9, -0.45], [0.36, 2.6, 0.36]); part(building, cylinder, stone, [-1.05, top + 2.25, -0.45], [0.46, 0.2, 0.46]);
      chimneyAt.push(V(s.x - 1.05, top + 2.45, s.z - 0.45));
      part(building, cylinder, wood, [-2.35, 0.32, 1.15], [0.42, 0.64, 0.42]);
      part(building, cube, steel, [-2.35, 0.78, 1.15], [0.62, 0.22, 0.32]); part(building, cube, steel, [-2.35, 0.7, 1.15], [0.28, 0.2, 0.22]); part(building, cone, steel, [-2.75, 0.8, 1.15], [0.1, 0.3, 0.1], [0, 0, Math.PI / 2]);
      part(building, cylinder, wood, [2.05, 0.45, 0.85], [0.36, 0.9, 0.36]); for (const y of [0.2, 0.7]) part(building, cylinder, timber, [2.05, y, 0.85], [0.38, 0.06, 0.38]);
      part(building, cube, timber, [2.0, 2.05, 1.25], [0.7, 0.06, 0.06]); part(building, cube, wood, [2.2, 1.75, 1.25], [0.07, 0.45, 0.8]);
      part(building, cylinder, cream, [2.25, 1.75, 1.25], [0.035, 0.5, 0.035], [0.6, 0, 0]); part(building, cube, steel, [2.25, 1.93, 1.12], [0.05, 0.13, 0.22], [0.6, 0, 0]);
    } else if (s.id === 'book') {
      // Wren's Beast Book cottage: cream walls with timber beams, a mossy roof, a round window, an open-book sign and a lantern.
      cottage(building, plasterWall, moss, 3.4, 2.5, 1.7);
      for (const x of [-1.7, 1.7]) part(building, cube, timber, [x * 0.5, 1.3, 1.27], [0.12, 1.7, 0.05]);
      part(building, cube, timber, [1.0, 1.75, 1.27], [1.2, 0.1, 0.05]);
      part(building, roundGeo, timber, [1.0, 1.25, 1.27], [0.38, 0.38, 0.06]); part(building, roundGeo, lamp, [1.0, 1.25, 1.3], [0.3, 0.3, 0.04]);
      part(building, cube, timber, [1.0, 1.25, 1.33], [0.6, 0.05, 0.03]); part(building, cube, timber, [1.0, 1.25, 1.33], [0.05, 0.6, 0.03]);
      part(building, cylinder, wood, [-2.3, 1.0, 1.5], [0.06, 2.0, 0.06]);
      for (const s2 of [-1, 1]) part(building, cube, paper, [-2.3 + s2 * 0.24, 2.08, 1.53], [0.46, 0.05, 0.34], [0, 0, s2 * 0.35]);
      part(building, cube, plum, [-2.3, 2.0, 1.53], [0.96, 0.05, 0.38]);
      part(building, cylinder, timber, [2.15, 1.0, 1.0], [0.05, 2.0, 0.05]); part(building, cylinder, gold, [2.15, 2.05, 1.0], [0.14, 0.24, 0.14]); part(building, sphere, lamp, [2.15, 2.05, 1.0], [0.1, 0.12, 0.1]); part(building, cone, timber, [2.15, 2.28, 1.0], [0.2, 0.18, 0.2]);
      [plum, skyBlue, roof, leafy, gold].forEach((m, i) => part(building, cube, m, [-1.95 - (i % 2) * 0.04, 0.11 + i * 0.13, 0.7], [0.6 - i * 0.05, 0.12, 0.42], [0, i * 0.25, 0]));
    } else if (s.id === 'board') {
      // The hunt board: stout posts on stones, a little shingled roof, and pinned notes about each beast.
      for (const x of [-1.25, 1.25]) { part(building, cylinder, wood, [x, 1.25, 0], [0.13, 2.5, 0.13]); part(building, ico, stone, [x, 0.12, 0], [0.32, 0.2, 0.3]); }
      blockers.push(mesh(building, cube, wood, [0, 1.65, 0], [2.7, 1.45, 0.2]));
      part(building, cube, timber, [0, 2.43, 0.02], [2.95, 0.12, 0.28]); part(building, cube, timber, [0, 0.9, 0.02], [2.95, 0.1, 0.26]);
      for (const sd of [-1, 1]) part(building, cube, shingle, [0, 2.75, sd * 0.3], [3.3, 0.1, 0.72], [sd * 0.62, 0, 0]);
      part(building, cylinder, timber, [0, 2.97, 0], [0.07, 3.3, 0.07], [0, 0, Math.PI / 2]);
      [[-0.85, 1.8, paper, 0.08], [-0.15, 1.95, toon(0xf5d2c8), -0.06], [0.6, 1.75, paper, 0.05], [-0.55, 1.25, toon(0xd9ecf2), -0.04], [0.35, 1.25, toon(0xf2e6b8), 0.07], [0.95, 1.3, paper, -0.1]].forEach(([x, y, m, r]) => {
        part(building, cube, m as T.Material, [x as number, y as number, 0.12], [0.55, 0.45, 0.02], [0, 0, r as number]);
        part(building, sphere, berryMat, [x as number, (y as number) + 0.18, 0.14], [0.04, 0.04, 0.04]);
        part(building, cube, ink, [x as number, (y as number) - 0.03, 0.135], [0.32, 0.03, 0.01], [0, 0, r as number]);
      });
      part(building, cube, wood, [-1.9, 0.3, 0.5], [0.6, 0.6, 0.6], [0, 0.3, 0]); part(building, cube, timber, [-1.9, 0.3, 0.5], [0.62, 0.08, 0.62], [0, 0.3, 0]);
    } else {
      // Pip's Pantry: a market stall with a striped awning, baskets on the counter, a carrot sign, crates and sacks.
      building.rotation.y = 0.55;
      for (const x of [-1.3, 1.3]) for (const z of [-0.75, 0.75]) mesh(building, cylinder, wood, [x, 1.15, z], [0.08, 2.3, 0.08]);
      for (const x of [-0.4, 0.4]) part(building, cylinder, timber, [x, 2.6, 0.98], [0.02, 0.5, 0.02]);
      for (let i = 0; i < 5; i++) { const stripe = mesh(building, cube, i % 2 ? cream : rose, [-1.2 + i * 0.6, 2.4, 0.05], [0.6, 0.1, 2.0]); stripe.rotation.x = 0.22; }
      for (let i = 0; i < 9; i++) part(building, sphere, i % 2 ? cream : rose, [-1.2 + i * 0.3, 2.22, 1.08], [0.16, 0.16, 0.06]);
      blockers.push(mesh(building, cube, wood, [0, 0.5, 0.35], [2.8, 1, 0.75]));
      part(building, cube, timber, [0, 1.02, 0.35], [2.95, 0.08, 0.85]);
      for (const [x, fill] of [[-0.85, berryMat], [0, gold], [0.85, berryMat]] as const) {
        mesh(building, cylinder, toon(0xc79b5c), [x, 1.12, 0.35], [0.3, 0.22, 0.3]);
        for (let k = 0; k < 5; k++) mesh(building, sphere, fill, [x + Math.cos(k * 1.3) * 0.15, 1.27 + (k % 2) * 0.04, 0.35 + Math.sin(k * 1.3) * 0.15], [0.09, 0.09, 0.09], false);
      }
      part(building, cube, cream, [0, 2.95, 0.98], [1.2, 0.42, 0.06], [-0.1, 0, 0]); part(building, cone, carrotMat, [0, 2.95, 1.03], [0.09, 0.5, 0.05], [0, 0, Math.PI / 2 - 0.3]); part(building, cone, leafy, [-0.3, 3.05, 1.03], [0.08, 0.18, 0.04], [0, 0, 1.3]);
      const bale = mesh(building, cylinder, hayMat, [1.85, 0.42, 0.7], [0.42, 0.85, 0.42]); bale.rotation.z = Math.PI / 2;
      part(building, cube, wood, [-2.05, 0.28, -0.2], [0.6, 0.56, 0.5]);
      for (let k = 0; k < 5; k++) part(building, cone, carrotMat, [-2.23 + k * 0.09, 0.62, -0.25 + (k % 2) * 0.1], [0.06, 0.28, 0.06], [Math.PI, 0, (k - 2) * 0.15]);
      part(building, sphere, sack, [-1.85, 0.36, -0.95], [0.36, 0.38, 0.34]); part(building, cylinder, timber, [-1.85, 0.74, -0.95], [0.12, 0.08, 0.12]);
    }
    const length = Math.hypot(s.x, s.z - 5), path = mesh(paths, plane, dirtMat, [s.x / 2, 0.025, (s.z + 5) / 2], [2.3, length + 1, 1], false); path.rotation.set(-Math.PI / 2, 0, -Math.atan2(s.x, 5 - s.z));
  }
  // Flower clumps between the paths and beside the cottages, batched with the rest of the decor.
  const garden = new T.Group(); village.add(garden);
  const blooms = [0xf2a7c3, 0xffe07a, 0xfdf6ea, 0xc6a6e8].map((c) => toon(c, undefined, false)), stem = toon(0x5e9a43, undefined, false);
  [[3, 4.4], [2.4, -1.5], [-2.6, -1.5], [-3.4, 7.6], [4, 8.2], [9.6, -0.4], [-9.8, -0.2], [-3.6, 2.6], [8.2, 4]].forEach(([x, z], i) => {
    for (let k = 0; k < 6; k++) { const a = k * 2.4 + i, rr = 0.15 + (k % 3) * 0.16, fx = x + Math.cos(a) * rr, fz = z + Math.sin(a) * rr, tall = 0.28 + (k % 2) * 0.12;
      part(garden, cylinder, stem, [fx, tall / 2, fz], [0.025, tall, 0.025]); part(garden, ico, blooms[(i + k) % 4], [fx, tall + 0.04, fz], [0.09, 0.06, 0.09]); }
    part(garden, blobGeo, stem, [x, 0.08, z], [0.42, 0.16, 0.42]);
  });
  // Everything except the camera-blocking walls moves into `decor` and is instanced.
  village.updateMatrixWorld(true);
  for (const building of [...village.children]) if (building !== decor) for (const child of [...building.children]) if (child instanceof T.Mesh && !blockers.includes(child)) decor.attach(child);
  batchMeshes(decor, false);
  const puffMat = noOutline(new T.MeshBasicMaterial({ color: 0xe9e4dc, transparent: true, opacity: 0.8, depthWrite: false })); materials.add(puffMat);
  const chimneyPuffs = Array.from({ length: 6 }, () => mesh(village, sphere, puffMat, [0, 0, 0], [0.3, 0.3, 0.3], false));
  const villageBlockerCount = blockers.length;
  // The hunt-start trail samples the area's ground painting at the ground's own scale, darkened, so it reads as a worn patch.
  const trailMat = toon(0xc9b597, groundMat.map!, false); Object.assign(trailMat, { alphaMap: edge, transparent: true, depthWrite: false });
  const trailGeo = new T.PlaneGeometry(4.2, 11); trailGeo.rotateX(-Math.PI / 2);
  const tp = trailGeo.getAttribute('position');
  const groundUv = new T.BufferAttribute(new Float32Array(tp.count * 2), 2);
  for (let i = 0; i < tp.count; i++) groundUv.setXY(i, (tp.getX(i) + 90) / 180, (90 - tp.getZ(i) - 12) / 180);
  trailGeo.setAttribute('groundUv', groundUv);
  trailMat.onBeforeCompile = (shader) => {
    shader.uniforms.uMute = mute;
    shader.vertexShader = 'attribute vec2 groundUv;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = (mapTransform * vec3(groundUv, 1)).xy;');
    shader.fragmentShader = 'uniform float uMute;\n' + shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), uMute);');
  };
  const campPath = mesh(scene, trailGeo, trailMat, [0, 0.015, 12], [1, 1, 1], false);
  const areaMaps: T.Texture[] = [];
  const areaCard = noOutline(new T.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp, alphaTest: 0.35, side: T.DoubleSide })); materials.add(areaCard);
  const shoreMat = toon(0x6e5c40, undefined, false), glintMat = toon(0xc9eef0, undefined, false);
  // Pond water: slow moving light ripples in world space, still when motion is reduced (the wind clock stops).
  const waterMat = toon(0x7fb4c0, undefined, false);
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = 'varying vec2 vWater;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
      #endif
      vWater = (modelMatrix * wp).xz;`);
    shader.fragmentShader = 'uniform float uWind; varying vec2 vWater;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec2 q = vWater * 1.6; float t = uWind;
      float w = sin(q.x + t * 1.2 + sin(q.y * 1.3 + t * 0.7) * 1.5) * sin(q.y * 1.1 - t * 0.9 + sin(q.x * 0.8 - t * 0.4) * 1.2);
      diffuseColor.rgb = diffuseColor.rgb * (0.93 + 0.07 * w) + vec3(0.8, 0.95, 1.0) * smoothstep(0.55, 0.92, w) * 0.3;`);
  };
  const lilyMat = toon(0x79a45b), iceMat = toon(0xa7dce9), snowMat = toon(0xf4f5ff), flagMat = toon(0xe3b672);
  const baseFog = new T.Color(0xc8dfd2);
  function switchArea(area: string) {
    if (area === currentArea) return;
    currentArea = area;
    groundMat.map = grassMap; dirtMat.map = dirtMap; trailMat.map = grassMap; areaCard.map = null; scene.background = sky;
    for (const t of areaMaps.splice(0)) { textures.delete(t); t.dispose(); }
    const data: Record<string, [string, string, string, number]> = {
      marsh: ['tex-marsh-mud', 'sky-marsh', 'card-reeds', 0xb3a6c1], ridge: ['tex-ridge-slate', 'sky-ridge', 'card-pine', 0xc5ddeb],
      hollow: ['tex-hollow-sand', 'sky-hollow', 'card-mushrooms', 0xe6c5a4], peak: ['tex-peak-snow', 'sky-peak', 'card-snowfir', 0xc8d4e9],
    };
    const d = data[area];
    groundMat.color.set(d ? 0xffffff : 0xd4dfbd); dirtMat.color.set(d ? 0xffffff : 0xe8d9bd);
    scene.fog = new T.Fog(d?.[3] ?? 0xc8dfd2, 22, 86); baseFog.set(d?.[3] ?? 0xc8dfd2);
    // Hills, rocks, the start trail and the light bounced up from the ground take each area's colours.
    const tints: Record<string, number[]> = { marsh: [0x7d8a5f, 0xa9ad97, 0xb3a184, 0x8a8560], ridge: [0x6f8a78, 0xb2b7b4, 0xbdb39b, 0x7f9670], hollow: [0xc99a62, 0xe6c9a4, 0xe8d6c2, 0xc29a68], peak: [0xdfe8f2, 0xc6cdd9, 0xc4d0e6, 0xb8c6dc] };
    const [hill, stone, trail, bounce] = tints[area] ?? [0x739d64, 0xc7cac0, 0xc9b597, 0x7c9d55];
    hillMat.color.set(hill); rockMat.color.set(stone); calm.value = ({ hollow: 0.4, ridge: 0.15, marsh: 0.3 } as Record<string, number>)[area] ?? 0; mute.value = ({ hollow: 0.35, marsh: 0.25 } as Record<string, number>)[area] ?? 0; pathMute.value = d ? mute.value : 0.22; trailMat.color.set(trail); skyLight.groundColor.set(bounce);
    grass.visible = grassTufts.visible = !d || area === 'ridge';
    if (d) {
      const ground = texture(d[0], 32), paintedSky = texture(d[1]), card = texture(d[2]); areaMaps.push(ground, paintedSky, card);
      paintedSky.mapping = T.EquirectangularReflectionMapping; paintedSky.wrapS = paintedSky.wrapT = T.ClampToEdgeWrapping;
      card.wrapS = card.wrapT = T.ClampToEdgeWrapping; groundMat.map = ground; dirtMat.map = ground; trailMat.map = ground; areaCard.map = card; scene.background = paintedSky;
    }
    foliage.map = d ? areaCard.map : leaf; foliage.needsUpdate = true;
    groundMat.needsUpdate = dirtMat.needsUpdate = trailMat.needsUpdate = areaCard.needsUpdate = true;
  }
  // Snowflakes are plain white without an outline, which would turn each one into a dark speck.
  const flakeMat = noOutline(new T.MeshBasicMaterial({ color: 0xffffff })); materials.add(flakeMat);
  // A blizzard thickens the Peak's snowfall from 140 flakes to 520 and blows them sideways.
  const FLAKES = 140, BLIZZARD = 520, snowfall = new T.InstancedMesh(ico, flakeMat, BLIZZARD); snowfall.visible = false; scene.add(snowfall);
  // Weather: rain streaks and drifting dust motes, each one draw, shown in proportion to the weather's strength.
  const RAIN = 380, DUST = 260;
  const rainGeo = new T.BoxGeometry(0.025, 0.7, 0.025), rainMat = noOutline(new T.MeshBasicMaterial({ color: 0xd6e6f2, transparent: true, opacity: 0.5, depthWrite: false })); materials.add(rainMat);
  const rain = new T.InstancedMesh(rainGeo, rainMat, RAIN); rain.visible = false; rain.frustumCulled = false; scene.add(rain);
  const dustMat = noOutline(new T.MeshBasicMaterial({ color: 0xe0b27a, transparent: true, opacity: 0.55, depthWrite: false })); materials.add(dustMat);
  const dust = new T.InstancedMesh(ico, dustMat, DUST); dust.visible = false; dust.frustumCulled = false; scene.add(dust);
  snowfall.frustumCulled = false;
  // Fog each weather blows towards at full strength: colour, near and far.
  const WEATHER_FOG: Record<WeatherKind, [number, number, number]> = { clear: [0xc8dfd2, 22, 86], rain: [0xa3b3bf, 12, 56], mist: [0xe9eef0, 5, 32], dust: [0xd8a771, 6, 36], blizzard: [0xeef3fa, 5, 32] };
  const fogTarget = new T.Color(), slant = new T.Quaternion();
  // Butterflies over the meadow and camp: one draw per wing side, each wing a big upper and small lower lobe hinged on the body line.
  const wingGeo = (() => {
    const shape = new T.Shape(); shape.moveTo(0, 0.02); shape.bezierCurveTo(0.35, 0.45, 0.62, 0.16, 0.48, -0.04); shape.bezierCurveTo(0.42, -0.12, 0.38, -0.36, 0.2, -0.32); shape.bezierCurveTo(0.08, -0.3, 0.03, -0.12, 0, -0.06);
    const g = new T.ShapeGeometry(shape, 6); g.rotateX(Math.PI / 2); geometries.add(g); return g;
  })();
  const wingMat = noOutline(new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide })); materials.add(wingMat);
  const BUTTERFLIES = 10, wings = [0, 1].map(() => { const w = new T.InstancedMesh(wingGeo, wingMat, BUTTERFLIES); w.visible = false; scene.add(w); return w; });
  const wingColors = [0xffe066, 0xfffaf0, 0xff9cc6, 0x8cc8ff, 0xffa94d];
  for (let i = 0; i < BUTTERFLIES; i++) for (const w of wings) w.setColorAt(i, tint.set(wingColors[i % wingColors.length]));
  // Fireflies over the marsh: small warm-green glows drifting low.
  const fireflyMat = noOutline(new T.MeshBasicMaterial({ color: 0xe6ff9a, toneMapped: false })); materials.add(fireflyMat);
  const FIREFLIES = 18, fireflies = new T.InstancedMesh(ico, fireflyMat, FIREFLIES); fireflies.visible = false; scene.add(fireflies);
  const yawQ = new T.Quaternion(), flapQ = new T.Quaternion(), wingAt = new T.Vector3(), wingSize = new T.Vector3(), forward = new T.Vector3(0, 0, 1), upAxis = new T.Vector3(0, 1, 0);
  function ambientLife(time: number) {
    const fluttery = (currentArea === 'meadow' || currentArea === 'paddock') && !reduced.matches;
    for (const w of wings) w.visible = fluttery;
    fireflies.visible = currentArea === 'marsh' && !reduced.matches;
    if (fluttery) {
      for (let i = 0; i < BUTTERFLIES; i++) {
        const a = i * 2.39, r = 6 + (i * 7.7) % 15, t = time * (0.35 + (i % 3) * 0.08) + i * 1.7;
        const x = Math.cos(a) * r + Math.sin(t) * 2.6, z = Math.sin(a) * r + Math.cos(t * 0.8) * 2.6, y = 0.9 + 0.35 * Math.sin(time * 1.9 + i * 2) + (i % 4) * 0.25;
        const yaw = Math.atan2(Math.cos(t) * 2.6, -Math.sin(t * 0.8) * 2.08), flap = 0.25 + 0.95 * Math.abs(Math.sin(time * 13 + i * 1.3));
        yawQ.setFromAxisAngle(upAxis, yaw);
        wings.forEach((w, side) => { flapQ.setFromAxisAngle(forward, side ? -flap : flap).premultiply(yawQ); matrix.compose(wingAt.set(x, y, z), flapQ, wingSize.set(side ? -0.55 : 0.55, 0.55, 0.55)); w.setMatrixAt(i, matrix); });
      }
      for (const w of wings) w.instanceMatrix.needsUpdate = true;
    }
    if (fireflies.visible) {
      for (let i = 0; i < FIREFLIES; i++) {
        const a = i * 2.39 + time * 0.05, r = 4 + (i * 5.3) % 18, glow = 0.5 + 0.5 * Math.sin(time * 2.2 + i * 1.9);
        matrix.compose(wingAt.set(Math.cos(a) * r + Math.sin(time * 0.6 + i) * 1.2, 0.6 + 0.5 * Math.sin(time * 0.9 + i * 2.3) + (i % 3) * 0.3, Math.sin(a) * r + Math.cos(time * 0.5 + i) * 1.2), upright, wingSize.setScalar(0.05 + 0.07 * glow));
        fireflies.setMatrixAt(i, matrix);
      }
      fireflies.instanceMatrix.needsUpdate = true;
    }
  }
  /** Instance repeated meshes; `plain` batches also drop out of the shadow and outline passes. */
  const plainMaterials = new Map<T.Material, T.Material>();
  function batchMeshes(root: T.Group, plain: boolean) {
    const groups = new Map<string, T.Mesh[]>();
    for (const child of [...root.children]) if (child instanceof T.Mesh && !Array.isArray(child.material)) {
      const key = `${child.geometry.uuid}:${child.material.uuid}`;
      const list = groups.get(key) ?? []; list.push(child); groups.set(key, list);
    }
    for (const list of groups.values()) {
      const original = list[0].material as T.Material;
      let material = plain ? plainMaterials.get(original) : original;
      if (!material) { material = noOutline(original.clone()); plainMaterials.set(original, material); materials.add(material); }
      const batch = new T.InstancedMesh(list[0].geometry, material, list.length);
      if (!plain) { batch.castShadow = list[0].castShadow; batch.receiveShadow = list[0].receiveShadow; }
      list.forEach((child, i) => { child.updateMatrix(); batch.setMatrixAt(i, child.matrix); root.remove(child); });
      root.add(batch);
    }
  }
  const villagers: { rig: VillagerRig; x: number; z: number; face: number; spot: SpotId; top: number }[] = [];
  const VILLAGER_AT: Record<typeof SPOTS[number]['id'], VillagerId> = { board: 'mossback', forge: 'bramble', pantry: 'pip', book: 'wren' };
  for (const station of SPOTS) {
    const rig = createVillager(VILLAGER_AT[station.id], { ramp, materials, geometries, shade: (m) => fluffy(m, 0.3) }), at = VILLAGERS[station.id];
    rig.root.position.set(at.x, 0, at.z); rig.root.rotation.y = at.face; village.add(rig.root);
    villagers.push({ rig, x: at.x, z: at.z, face: at.face, spot: station.id, top: new T.Box3().setFromObject(rig.root).max.y });
  }
  const partAt = V(), partSize = V();
  /** Places every tree's crown blobs and camera-facing leaf cards, shrunk toward the crown centre by how hidden the tree is. */
  function placeCanopies(force?: number) {
    if (!crowns || !leafCards) return;
    let blob = 0, card = 0;
    canopyPositions.forEach((p, i) => {
      const shown = force ?? canopyShown[i];
      for (const b of treeBlobs[i]) { partAt.copy(b.at).applyQuaternion(treeTurn[i]).multiplyScalar(shown).add(p); matrix.compose(partAt, treeTurn[i], partSize.copy(b.size).multiplyScalar(shown)); crowns!.setMatrixAt(blob++, matrix); }
      for (const c of treeCards[i]) { partAt.copy(c.at).multiplyScalar(shown).add(p); matrix.compose(partAt, camera.quaternion, partSize.copy(c.size).multiplyScalar(shown)); leafCards!.setMatrixAt(card++, matrix); }
    });
    crowns.instanceMatrix.needsUpdate = true; leafCards.instanceMatrix.needsUpdate = true;
  }
  function buildWorld(game: HuntGame) {
    switchArea(game.mode === 'village' || game.mode === 'camp' ? 'meadow' : game.area);
    // Reuse a shared set of geometries and materials when hunts change.
    while (world.children.length) { const child = world.children[0]; child.traverse((o) => { if (o instanceof T.InstancedMesh) o.dispose(); }); world.remove(child); }
    canopyPositions.length = 0; canopyShown.length = 0;
    blockers.length = villageBlockerCount;
    const trees = game.obstacles.filter((o) => o.kind === 'tree' || o.kind === 'pine');
    const leafy = currentArea === 'meadow' || currentArea === 'paddock';
    treeBlobs.length = treeCards.length = treeTurn.length = 0;
    let treeSeed = 17 + trees.length;
    const jitter = () => { treeSeed = (Math.imul(treeSeed, 1664525) + 1013904223) >>> 0; return treeSeed / 4294967296; };
    for (const o of trees) {
      const blobs: TreePart[] = [], cards: TreePart[] = [], big = 0.85 + o.r * 0.35;
      if (o.kind === 'pine') {
        // Three stacked tiers and a tip.
        [[-1.2, 1.75, 1.5], [-0.15, 1.4, 1.35], [0.85, 1.0, 1.2], [1.6, 0.55, 0.8]].forEach(([y, r, h]) => blobs.push({ at: V(0, y, 0), size: V(r * big, h, r * big) }));
        cards.push({ at: V(0, 0.2, 0), size: V(5, 4.4, 1) });
      } else {
        blobs.push({ at: V(0, 0, 0), size: V(1.45 * big, 1.2 * big, 1.45 * big) }, { at: V(0.1, 0.85 * big, -0.1), size: V(1.0 * big, 0.9 * big, 1.0 * big) });
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + jitter() * 0.9, r = 0.95 * big, s = (0.8 + jitter() * 0.3) * big; blobs.push({ at: V(Math.cos(a) * r, -0.3 + jitter() * 0.55, Math.sin(a) * r), size: V(s, s * 0.85, s) }); }
        if (leafy) for (let k = 0; k < 3; k++) { const a = k * 2.1 + jitter(); cards.push({ at: V(Math.cos(a) * 0.9 * big, 0.25 + k * 0.25, Math.sin(a) * 0.9 * big), size: V(2.8 * big, 2.5 * big, 1) }); }
        // Marsh reeds grow in a bed around the trunk's foot, not out of the crown.
        else cards.push(currentArea === 'marsh' ? { at: V(0, -2.75, 0), size: V(4.2, 3.4, 1) } : { at: V(0, 0.5, 0), size: V(5, 4.4, 1) });
      }
      treeBlobs.push(blobs); treeCards.push(cards);
      treeTurn.push(new T.Quaternion().setFromAxisAngle(V(0, 0, 1), o.kind === 'pine' && currentArea === 'ridge' ? -0.14 : 0));
    }
    const trunks = new T.InstancedMesh(trunkGeo, barkMat, trees.length);
    crowns = new T.InstancedMesh(trees.some((o) => o.kind === 'pine') ? pineGeo : blobGeo, canopyMat, treeBlobs.reduce((n, b) => n + b.length, 0));
    leafCards = new T.InstancedMesh(plane, foliage, treeCards.reduce((n, c) => n + c.length, 0));
    trunks.castShadow = true; trunks.receiveShadow = true;
    world.add(trunks, crowns!, leafCards); blockers.push(trunks);
    const greens = currentArea === 'marsh' ? [0x5f7f45, 0x6f8c4c, 0x55733f] : currentArea === 'ridge' || currentArea === 'peak' ? [0x3f6f52, 0x4a7b5a, 0x376449] : [0x4f8a3c, 0x62a046, 0x76b04e, 0x5a9440];
    let blob = 0;
    trees.forEach((o, i) => {
      matrix.compose(V(o.x, 0, o.z), treeTurn[i], V(o.r * 0.65, 1, o.r * 0.65)); trunks.setMatrixAt(i, matrix);
      canopyPositions.push(V(o.x, o.kind === 'pine' ? 4.2 : 4.3, o.z)); canopyShown.push(1);
      for (const _ of treeBlobs[i]) crowns!.setColorAt(blob++, tint.set(greens[(i * 3 + blob) % greens.length]));
    });
    placeCanopies(1);
    for (const o of game.obstacles) {
      if (o.kind === 'rock') { const m = mesh(world, rockGeo, rockMat, [o.x, o.r * 0.42, o.z], [o.r, o.r * 0.8, o.r]); m.rotation.y = o.x; blockers.push(m); }
    }
    if (currentArea !== 'meadow' && currentArea !== 'paddock') {
      const cards = new T.InstancedMesh(plane, areaCard, 12); world.add(cards);
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; matrix.compose(V(Math.cos(a) * 20, 1.6, Math.sin(a) * 20), upright, V(3, 3.2, 1)); cards.setMatrixAt(i, matrix); }
    }
    // Area props are batched into one instanced mesh per shape and material, to keep draw calls in budget.
    const props = new T.Group(); world.add(props);
    if (currentArea === 'paddock') {
      for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28, next = (i + 1) / 24 * 6.28; mesh(props, cylinder, wood, [Math.cos(a) * 13, 0.6, Math.sin(a) * 13], [0.1, 1.2, 0.1]); const rail = mesh(props, cube, wood, [(Math.cos(a) + Math.cos(next)) * 6.5, 0.7, (Math.sin(a) + Math.sin(next)) * 6.5], [3.5, 0.12, 0.12]); rail.rotation.y = -a - Math.PI / 2; }
    }
    for (let i = 0; i < 6; i++) {
      const x = Math.cos(i * 2.1) * 14, z = Math.sin(i * 2.1) * 14;
      if (currentArea === 'marsh') { mesh(props, pondGeo, shoreMat, [x, 0.015, z], [3.45, 0.02, 2.4], false); mesh(props, pondGeo, waterMat, [x, 0.025, z], [3, 0.025, 2], false); mesh(props, pondGeo, glintMat, [x - 0.8, 0.03, z - 0.5], [1, 0.02, 0.35], false); for (let k = 0; k < 3; k++) mesh(props, cylinder, lilyMat, [x + k - 1, 0.07, z + k * 0.3], [0.45, 0.02, 0.4], false); }
      if (currentArea === 'ridge') { mesh(props, rockGeo, rockMat, [x, 1.1, z], [0.6, 2, 0.7]); mesh(props, cylinder, wood, [x + 1, 1.7, z], [0.04, 3.4, 0.04]); mesh(props, plane, flagMat, [x + 1.4, 2.9, z], [0.8, 0.5, 1], false); }
      if (currentArea === 'hollow') { mesh(props, rockGeo, rockMat, [x, 0.45, z], [1.5, 0.8, 1.2]); mesh(props, rockGeo, rockMat, [x - 0.1, 1.35, z], [1, 0.6, 0.8]); mesh(props, crystalGeo, iceMat, [x + 1.1, 0, z + 0.3], [0.45, 0.5, 0.45]); mesh(props, sphere, ink, [x - 1, 0.04, z], [0.6, 0.04, 0.5], false); }
      if (currentArea === 'peak') { mesh(props, crystalGeo, iceMat, [x, 0, z], [1.1, 1.3, 1.1]); mesh(props, sphere, snowMat, [x - 2.2, 0, z], [2.1, 0.9, 1.7]); mesh(props, sphere, snowMat, [x - 1.1, 0, z + 1], [1.1, 0.5, 0.9]); }
    }
    if (currentArea === 'marsh') for (let i = 0; i < 3; i++) { const x = -13 + i * 12, z = 11 - i * 8; mesh(props, cylinder, barkMat, [x, 0.35, z], [0.35, 2.4, 0.35]).rotation.z = Math.PI / 2; mesh(props, cylinder, cream, [x + 1, 0.3, z + 1], [0.12, 0.6, 0.12]); mesh(props, sphere, rose, [x + 1, 0.65, z + 1], [0.45, 0.17, 0.45]); }
    if (currentArea === 'peak') { mesh(props, cylinder, rockMat, [0, 0.3, -15], [2.5, 0.6, 2.5]); for (const x of [-0.6, 0.6]) mesh(props, crystalGeo, iceMat, [x, 0.6, -15], [0.8, 1.2, 0.8]).rotation.y = x * 2; }
    batchMeshes(props, false);
    spotRigs.length = 0;
    for (const s of game.spots) {
      const root = new T.Group(), fruit = new T.Group(); root.position.set(s.x, 0, s.z); root.rotation.y = s.id; root.add(fruit); world.add(root);
      if (s.material === 'berry') {
        // A clump of leafy mounds, the top ones lighter, with berries resting on their surface.
        const mounds: [number, number, number, number][] = [[0, 0.45, 0, 0.7], [0.45, 0.38, 0.25, 0.48], [-0.42, 0.36, 0.3, 0.46], [0.05, 0.36, -0.48, 0.5], [0.08, 0.85, 0.05, 0.45]];
        mounds.forEach(([x, y, z, r], k) => mesh(root, blobGeo, k === 4 ? bushLight : bushMat, [x, y, z], [r, r * 0.85, r]));
        for (let k = 0; k < 12; k++) { const [x, y, z, r] = mounds[k % 5], a = k * 2.3 + 0.6, up = 0.15 + (k % 3) * 0.3, out = r * 1.12; mesh(fruit, sphere, berryMat, [x + Math.cos(a) * out * Math.cos(up), y + Math.sin(up) * out * 0.85, z + Math.sin(a) * out * Math.cos(up)], [0.12, 0.12, 0.12], false); }
      } else if (s.material === 'marsh-reed') {
        for (let k = 0; k < 7; k++) { const a = k * 2.1, r = 0.12 + (k % 3) * 0.14, tall = 1 + (k % 2) * 0.35, x = Math.cos(a) * r, z = Math.sin(a) * r;
          const stalk = mesh(root, cylinder, reedMat, [x, tall / 2, z], [0.035, tall, 0.035], false); stalk.rotation.z = (k % 3 - 1) * 0.08;
          mesh(fruit, cylinder, cattailMat, [x, tall + 0.1, z], [0.075, 0.32, 0.075], false); }
      } else {
        mesh(root, rockGeo, rockMat, [0, 0.2, 0], [0.7, 0.4, 0.6]);
        for (let k = 0; k < 4; k++) { const c = mesh(fruit, starGeo, crystalMat, [Math.cos(k * 1.6) * 0.3, 0.6 + (k % 2) * 0.2, Math.sin(k * 1.6) * 0.3], [1.4, 2.6 - k * 0.3, 1.4], false); c.rotation.z = (k - 1.5) * 0.3; }
      }
      batchMeshes(root, false); batchMeshes(fruit, false);
      spotRigs.push({ id: s.id, root, fruit, material: s.material });
    }
    const grounded = [...game.obstacles.map((o) => ({ x: o.x, z: o.z, r: o.kind === 'rock' ? o.r * 1.25 : o.r * 1.6 + 0.6 })), ...game.spots.map((s) => ({ x: s.x, z: s.z, r: 1.1 }))];
    const contacts = new T.InstancedMesh(contactGeo, contactMat, grounded.length); contacts.renderOrder = 1; world.add(contacts);
    grounded.forEach((c, i) => { matrix.compose(V(c.x, 0.03, c.z), upright, V(c.r * 2, 1, c.r * 2)); contacts.setMatrixAt(i, matrix); });
  }
  function actor(white: boolean): Rig {
    const model = createHuntChinchilla(white, (m) => fluffy(m, 0.3)); model.root.scale.setScalar(0.75); scene.add(model.root);
    const hammer = new T.Group(); model.body.add(hammer); hammer.position.set(0.46, 0.58, 0.32); hammer.scale.setScalar(1 / 0.75);
    // The swing plane tilts out to the right, so the wind-up passes beside the ear rather than through it.
    hammer.rotation.x = 0.45;
    mesh(hammer, cylinder, wood, [0, 0.39, 0], [0.034, 0.78, 0.034]);
    const head = new T.Group(); head.position.y = 0.82; head.rotation.z = Math.PI / 2; hammer.add(head);
    mesh(head, sphere, toon(0xc58a47), [0, -0.06, 0], [0.24, 0.29, 0.24]);
    mesh(head, sphere, wood, [0, 0.12, 0], [0.255, 0.12, 0.255]); mesh(head, cylinder, wood, [0, 0.28, 0], [0.025, 0.12, 0.025]);
    const trailGeo = new T.BufferGeometry().setFromPoints(Array.from({ length: 10 }, () => V())), trailMat = noOutline(new T.LineBasicMaterial({ color: 0xffd16b, transparent: true, opacity: 0.8 }));
    const trail = new T.Line(trailGeo, trailMat); trail.visible = false; geometries.add(trailGeo); materials.add(trailMat); scene.add(trail);
    hammer.visible = white;
    model.root.traverse((o) => { if (o instanceof T.Mesh) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); o.castShadow = (o.geometry.boundingSphere?.radius ?? 1) * Math.max(o.scale.x, o.scale.y, o.scale.z) > 0.22; geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(m); for (const t of Object.values(m)) if (t instanceof T.Texture) textures.add(t); } } else if (o instanceof T.Line) { geometries.add(o.geometry); materials.add(o.material as T.Material); } });
    const weapons = createHuntWeapons(model, toon, geometries, materials), hammerLook = decorateHuntWeapon(hammer, 'hammer', (c) => toon(c), geometries, materials);
    const armour: T.Group[] = [];
    for (let i = 0; i < 3; i++) {
      const g = new T.Group(); (i === 0 ? model.head : model.body).add(g); armour.push(g);
      // Small crest, leaf vest and low puffy boots leave cheeks and ears clear.
      if (i === 0) mesh(g, sphere, toon(0xa77c52), [0, 0.43, 0], [0.16, 0.055, 0.13]);
      else if (i === 1) mesh(g, sphere, toon(0x76975a), [-0.06, 0.48, 0], [0.58, 0.29, 0.52]);
      else for (const z of [-0.3, 0.3]) mesh(g, sphere, toon(0xb28f62), [-0.22, 0.09, z], [0.21, 0.1, 0.14]);
      g.visible = false;
    }
    return { model, hammer, head, trail, points: [], weapons, hammerLook, armour };
  }
  const actors: Record<HeroId, Rig> = { dora: actor(true), enzo: actor(false) };

  const steamMat = noOutline(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })); materials.add(steamMat);
  // Canvas-painted coats: short fur strokes, or soft toad mottling; both tile and multiply the coat colour.
  function coatTexture(kind: 'fur' | 'mottle') {
    const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ececec'; ctx.fillRect(0, 0, 256, 256);
    let seed = kind === 'fur' ? 7 : 11; const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < (kind === 'fur' ? 900 : 70); i++) {
      const x = r() * 256, y = r() * 256, light = r() < (kind === 'fur' ? 0.45 : 0.6);
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
        if (kind === 'fur') {
          ctx.strokeStyle = light ? 'rgba(255,255,255,0.55)' : 'rgba(60,45,35,0.16)'; ctx.lineWidth = 1.3; ctx.beginPath();
          ctx.moveTo(x + ox, y + oy); ctx.quadraticCurveTo(x + ox + 3, y + oy + 7, x + ox + 1.5, y + oy + 14); ctx.stroke();
        } else {
          const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, 9 + (i % 5) * 4);
          g.addColorStop(0, light ? 'rgba(255,255,230,0.6)' : 'rgba(70,80,30,0.13)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x + ox - 30, y + oy - 30, 60, 60);
        }
      }
    }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 2); t.anisotropy = 4; textures.add(t); return t;
  }
  const furStrokes = coatTexture('fur'), toadSkin = coatTexture('mottle');
  // Legs: a domed top that sinks into the body, a soft knee and a narrower ankle above the paw.
  const legGeo = new T.LatheGeometry([P(0, -0.5), P(0.86, -0.5), P(0.8, -0.36), P(0.9, -0.12), P(1.08, 0.12), P(1.15, 0.34), P(0.86, 0.54), P(0, 0.62)], 12); geometries.add(legGeo);
  function beastRig(id: BeastId): BeastRig {
    const root = new T.Group(), body = new T.Group(), head = new T.Group(), part = new T.Group(); root.add(body); body.add(head, part); scene.add(root);
    const legs: T.Group[] = [], wings: T.Group[] = [], eyes: T.Mesh[] = [];
    // Bristleback's painted fur already carries its brown, so its coat colour stays near white.
    const colors = { bristleback: 0xf0dccb, puffwart: 0x8c9948, skreel: 0x7189aa, hornclack: 0x7c8394, frostmane: 0xe3eff5 };
    const coatMap = { bristleback: fur, puffwart: toadSkin, skreel: furStrokes, hornclack: undefined, frostmane: furStrokes }[id];
    const coat = fluffy(toon(colors[id], coatMap), id === 'hornclack' ? 0.25 : 0.4), dark = fluffy(toon(id === 'frostmane' ? 0x91bedc : 0x483f3b), 0.15);
    coat.userData.beastColor = colors[id];
    const belly = fluffy(toon(id === 'skreel' ? 0xe9e4cf : 0xf3dfab), 0.2);
    // Eyebrows get their own material so they can turn red when the beast is Extra Grumpy.
    const brow = toon(id === 'frostmane' ? 0x91bedc : 0x483f3b);
    const rig: BeastRig = { root, body, head, part, legs, wings, eyes, brow, browColor: brow.color.clone(), steam: [] };
    function eye(x: number, y: number, z: number, s: number) {
      const white = mesh(head, sphere, cream, [x, y, z], [0.1, 0.15, 0.17]); eyes.push(white);
      eyes.push(mesh(head, sphere, ink, [x + 0.07, y, z + s * 0.065], [0.08, 0.095, 0.095]));
      const b = mesh(head, cube, brow, [x + 0.04, y + 0.15, z], [0.14, 0.075, 0.4]); b.rotation.x = s * 0.28;
    }
    function leg(x: number, z: number, long = 0.6) { const p = new T.Group(); p.position.set(x, 0.6, z); body.add(p); mesh(p, legGeo, coat, [0, -0.1, 0], [0.2, long, 0.2]); mesh(p, sphere, dark, [0.08, -long / 2 - 0.1, 0], [0.27, 0.15, 0.23]); legs.push(p); }
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
      const wart = fluffy(toon(0xb4aa5c), 0.2);
      for (let i = 0; i < 13; i++) { const a = i * 2.4; mesh(body, sphere, wart, [Math.cos(a) * 1.1, 1.7 + Math.sin(i) * 0.2, Math.sin(a) * 0.85], [0.22, 0.18, 0.22]); }
    } else if (id === 'skreel') {
      mesh(body, sphere, coat, [0, 1.4, 0], [1.1, 1.4, 1]); mesh(body, sphere, belly, [0.7, 1.2, 0], [0.55, 1.03, 0.8]); head.position.set(0.35, 2.1, 0);
      mesh(head, sphere, coat, [0, 0, 0], [0.95, 0.85, 1.0]);
      // Darker flight feathers fan out under each wing, so it reads as feathered when it flaps.
      const quill = fluffy(toon(0x56698a, furStrokes), 0.3); quill.userData.beastColor = 0x56698a;
      for (const s of [-1, 1]) { mesh(head, sphere, cream, [0.6, 0, s * 0.47], [0.35, 0.5, 0.4]); eye(0.8, 0.05, s * 0.5, s);
        const wing = new T.Group(); wing.position.set(-0.15, 1.8, s * 0.85); body.add(wing); const m = mesh(wing, sphere, coat, [-0.15, -0.55, s * 0.25], [0.5, 1.0, 0.32]); m.rotation.x = -s * 0.2; wings.push(wing); leg(0.25, s * 0.5, 0.35);
        for (let k = 0; k < 3; k++) { const f = mesh(wing, sphere, quill, [-0.12 - k * 0.24, -1.6 + k * 0.2, s * 0.3], [0.17, 0.5 - k * 0.06, 0.11]); f.rotation.set(-s * 0.2, 0, -0.2 - k * 0.35); }
        mesh(part, cone, coat, [-0.2, 2.95, s * 0.5], [0.3, 0.55, 0.25]); }
      const beak = mesh(head, cone, gold, [1, -0.08, 0], [0.23, 0.45, 0.22]); beak.rotation.z = -Math.PI / 2;
      for (let i = -1; i <= 1; i++) mesh(body, sphere, coat, [-1.03, 0.75, i * 0.32], [0.75, 0.2, 0.25]);
    } else if (id === 'hornclack') {
      mesh(body, sphere, dark, [0, 1.1, 0], [1.7, 1.1, 1.35]);
      for (let i = 0; i < 3; i++) mesh(body, sphere, coat, [-0.9 + i * 0.75, 1.35, 0], [0.78, 1.0, 1.32]);
      head.position.set(1.4, 1.05, 0); mesh(head, sphere, coat, [0, 0, 0], [0.65, 0.65, 0.8]);
      for (const s of [-1, 1]) { eye(0.4, 0.02, s * 0.58, s); for (const x of [-1.05, 0, 1.05]) leg(x, s * 1.15, 0.5); }
      const horn = mesh(part, hornGeo, cream, [1.7, 2, 0], [0.4, 1.8, 0.4]); horn.rotation.z = -0.4;
    } else {
      mesh(body, sphere, coat, [-0.15, 1.4, 0], [1.65, 0.95, 0.9]); head.position.set(1.15, 2, 0);
      mesh(head, sphere, coat, [0, 0, 0], [0.8, 0.8, 0.85]); mesh(head, sphere, cream, [0.65, -0.25, 0], [0.35, 0.28, 0.5]); mesh(head, sphere, rose, [0.91, -0.1, 0], [0.1, 0.1, 0.17]);
      rig.mane = new T.Group(); body.add(rig.mane);
      const mane = [fluffy(toon(0xc7e3ef), 0.35), fluffy(toon(0xa5cde7), 0.35)];
      for (let i = 0; i < 13; i++) { const a = i / 13 * Math.PI * 2, m = mesh(rig.mane, blobGeo, mane[i % 2], [0.72, 1.8 + Math.cos(a) * 0.72, Math.sin(a) * 0.8], [0.65, 0.5, 0.45]); m.rotation.x = a; }
      for (const s of [-1, 1]) { eye(0.5, 0.1, s * 0.6, s); const ear = mesh(head, cone, coat, [-0.15, 0.9, s * 0.55], [0.25, 0.7, 0.24]); ear.rotation.x = s * 0.2; mesh(part, cone, dark, [0.9, 3.25, s * 0.55], [0.075, 0.4, 0.075]); for (const x of [-1, 1]) leg(x, s * 0.65, 1); }
      const curve = new T.CatmullRomCurve3([V(-1.4, 1.4, 0), V(-2, 1.6, 0.2), V(-2.5, 2.2, 0.3), V(-2.35, 2.7, 0.3)]); mesh(body, new T.TubeGeometry(curve, 12, 0.32, 8, false), fluffy(toon(0xb5d4e9, furStrokes)), [0, 0, 0]);
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
  // A roar sends three pale sound rings rolling out across the ground.
  const roarMat = noOutline(new T.MeshBasicMaterial({ color: 0xfffaf0, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false })); materials.add(roarMat);
  const roarGeo = new T.RingGeometry(0.72, 1, 48); roarGeo.rotateX(-Math.PI / 2);
  const roarRings = Array.from({ length: 3 }, () => mesh(scene, roarGeo, roarMat, [0, 0.11, 0], [1, 1, 1], false));
  // The grab-on vine: a green rope from the leader's paw to the beast's head.
  const vineGeo = new T.CylinderGeometry(0.045, 0.045, 1, 6); vineGeo.translate(0, 0.5, 0);
  const vineLine = mesh(scene, vineGeo, toon(0x5d9a3c), [0, 0, 0], [1, 1, 1], false); vineLine.visible = false;
  const vineFrom = new T.Vector3(), vineTo = new T.Vector3(), vineDir = new T.Vector3();
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
  // Holding K: petals round the leader fill towards each charge level, a ring bursts out as a level
  // is reached and the petals pulse once the charge is full, while a warm glow gathers at the paws.
  // Guarding raises a leaf-green bubble in front instead.
  const PETALS = 18, petalMat = noOutline(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false, toneMapped: false })); materials.add(petalMat);
  const petals = new T.InstancedMesh(circleGeo, petalMat, PETALS); petals.frustumCulled = false; petals.visible = false; scene.add(petals);
  for (let i = 0; i < PETALS; i++) petals.setColorAt(i, tint.set(0xffffff));
  const burstMat = noOutline(new T.MeshBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, toneMapped: false })); materials.add(burstMat);
  const burst = mesh(scene, reachGeo, burstMat, [0, 0.08, 0], [1, 1, 1], false); burst.visible = false;
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
  const gc = glowCanvas.getContext('2d');
  if (gc) { const g = gc.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff8d8'); g.addColorStop(0.35, '#ffd36acc'); g.addColorStop(1, '#ffb44000'); gc.fillStyle = g; gc.fillRect(0, 0, 64, 64); }
  const glowMap = new T.CanvasTexture(glowCanvas); glowMap.colorSpace = T.SRGBColorSpace; textures.add(glowMap);
  const glowMat = noOutline(new T.SpriteMaterial({ map: glowMap, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })); materials.add(glowMat);
  const chargeGlow = new T.Sprite(glowMat); chargeGlow.visible = false; scene.add(chargeGlow);
  const bubbleGeo = new T.SphereGeometry(1, 24, 14, Math.PI / 2, Math.PI); geometries.add(bubbleGeo);
  // The Leaf Umbrella guards from every side, so it gets a whole dome.
  const domeGeo = new T.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); geometries.add(domeGeo);
  const bubbleMat = noOutline(new T.MeshBasicMaterial({ color: 0xa6dc84, transparent: true, opacity: 0.3, side: T.DoubleSide, depthWrite: false })); materials.add(bubbleMat);
  const guardBubble = new T.Mesh(bubbleGeo, bubbleMat); guardBubble.visible = false; scene.add(guardBubble);
  let chargeLevel = 0, burstTime = 1;
  const petalColor = new T.Color();
  function holdFx(game: HuntGame, dt: number) {
    const hold = game.hold(), h = game.hero, a = actors[game.heroId], still = reduced.matches, time = game.time;
    const charging = hold.kind === 'charge' && !game.ride.riding, fill = Math.min(1, hold.amount / (hold.levels === 2 ? 1 : 0.35)), full = charging && hold.level === hold.levels;
    petals.visible = chargeGlow.visible = charging;
    if (charging && hold.level > chargeLevel) burstTime = 0;
    chargeLevel = charging ? hold.level : 0;
    burstTime += dt; burst.visible = burstTime < 0.4 && !still;
    if (burst.visible) { const t = burstTime / 0.4; burst.position.set(h.x, 0.08, h.z); burst.scale.setScalar(0.7 + t * 1.1); burstMat.opacity = 0.85 * (1 - t); }
    if (charging) {
      const lit = fill * PETALS, pulse = full && !still ? 1 + Math.sin(time * 12) * 0.18 : 1;
      petalColor.set(full ? 0xfff0b8 : hold.level ? 0xffa040 : 0xffd56a);
      for (let i = 0; i < PETALS; i++) {
        const angle = h.face + (i / PETALS) * Math.PI * 2, on = Math.max(0, Math.min(1, lit - i)), size = (0.28 + 0.5 * on) * pulse;
        matrix.compose(V(h.x + Math.cos(angle) * 1.05, 0.07, h.z - Math.sin(angle) * 1.05), quat.identity(), V(size * 0.16, 1, size * 0.16)); petals.setMatrixAt(i, matrix);
        petals.setColorAt(i, on > 0 ? petalColor : tint.set(0xf6ecd0));
      }
      petals.instanceMatrix.needsUpdate = true; if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
      // Gather power: a little crouch, and a tremble once a level is ready.
      a.model.body.scale.y *= 1 - 0.07 * fill; if (hold.level && !still) { a.model.body.position.z = Math.sin(time * 47) * 0.012 * (full ? 1.6 : 1); a.model.body.rotation.x = Math.sin(time * 39) * 0.02; }
      a.model.root.updateMatrixWorld(true); a.model.arms[1].paw.getWorldPosition(chargeGlow.position);
      chargeGlow.scale.setScalar((0.25 + fill * 0.35) * (full && !still ? 1 + Math.sin(time * 12) * 0.15 : 1)); glowMat.opacity = 0.3 + 0.4 * fill;
    }
    guardBubble.visible = hold.kind === 'guard';
    if (guardBubble.visible) {
      const r = a.model.root, dome = game.weapon() === 'umbrella', breathe = still ? 0 : Math.sin(time * 6) * 0.03; guardBubble.geometry = dome ? domeGeo : bubbleGeo;
      if (dome) { guardBubble.position.set(r.position.x, r.position.y, r.position.z); guardBubble.scale.set(1.3, 1.45 + breathe, 1.3); }
      else { guardBubble.position.set(r.position.x + Math.cos(h.face) * 0.25, 0.75, r.position.z - Math.sin(h.face) * 0.25); guardBubble.scale.set(0.95, 0.85 + breathe, 1.05); }
      guardBubble.rotation.set(0, h.face, 0); bubbleMat.opacity = 0.18 + 0.2 * game.stamina / 100;
    }
  }
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
    else if (isPlayer && (game.bounce > 0 || game.float > 0)) height = game.airHeight;
    else if (isPlayer && game.vine?.phase === 'cling') height = 1.15;
    else if (isPlayer && game.vault > 0) height = Math.sin(game.vault / 0.8 * Math.PI) * (game.perk('air-bonk') ? 1.5 : 1);
    a.model.root.position.set(p.x, height, p.z); a.model.root.rotation.y = p.face;
    if (isPlayer && game.ride.landing > 0 && !reduced.matches) { const f = 1 - game.ride.landing / 0.6; a.model.root.position.y = (1 - f) * (game.beast ? RIDE_HEIGHT[game.beast.id] : 2) + Math.sin(f * Math.PI) * 0.7; if (game.beast) { a.model.root.position.x = lerp(game.beast.x, p.x, f); a.model.root.position.z = lerp(game.beast.z, p.z, f); } }
    animateHuntChinchilla(a.model, time, p.speed / 5, true);
    a.model.body.position.z = 0; a.model.body.rotation.x = 0;
    if (isPlayer && h.roll >= 0 && !reduced.matches) { a.model.body.rotation.z = -h.roll / 0.46 * Math.PI * 2; a.model.root.position.y = Math.sin(h.roll / 0.46 * Math.PI) * 0.3; }
    // A little item-use nod can finish sooner with Deep Breath, without delaying another item.
    else a.model.body.rotation.z = isPlayer && h.swing < 0 && !reduced.matches ? Math.min(0.12, game.itemRecovery * 0.4) : 0;
    a.model.feet.forEach((foot, i) => { foot.rotation.x = riding ? (i ? -0.5 : 0.5) : 0; if (riding) foot.position.y = 0.14; });
    if (isPlayer && h.covered > 0) { a.model.body.scale.y *= 0.9; a.model.body.scale.x *= 1.05; if (!reduced.matches) a.model.body.rotation.z = Math.sin(game.time * 28) * 0.07; }
    if (riding) { a.model.body.scale.y *= 0.85; a.model.body.rotation.z = game.ride.pose > 0 && !reduced.matches ? Math.sin(game.ride.pose / 0.22 * Math.PI) * -0.2 : 0; }
    const t = isPlayer && game.ride.riding && game.ride.pose > 0 ? 0.24 - game.ride.pose : preview ? showSwing() : p.swing;
    const weapon = game.weapon(id);
    // Upgrades show on the toy: a band at tier 2, gold and branch-beast trim at 3–4, a Glimmer stone at 5.
    const look = game.node(weapon); a.weapons.setLook(weapon, look.tier, look.branch); a.hammerLook.setLook(look.tier, look.branch);
    a.hammer.visible = weapon === 'hammer'; a.trail.visible = false;
    a.armour.forEach((g, i) => { const piece = game.profile.armour.worn[(['helm', 'vest', 'boots'] as const)[i]]; g.visible = isPlayer && !!piece; if (piece) { const color = BEASTS[piece.split('-')[0] as BeastId].color; g.traverse((o) => { if (o instanceof T.Mesh) (o.material as T.MeshToonMaterial).color.set(color); }); } });
    const hold = isPlayer ? game.hold() : null;
    // The preview opens the umbrella now and then, so the rack shows both its looks.
    const guard = preview ? weapon === 'umbrella' && !reduced.matches && showTime % 6 > 3 : hold?.kind === 'guard';
    a.weapons.pose(weapon, time, t, hold?.kind === 'charge' ? hold.amount : 0, guard, isPlayer ? game.breath / 6 : 0);
    if (weapon === 'hammer') {
      a.hammer.rotation.z = t < 0 ? 0.9 : t < 0.15 ? lerp(0.9, 1.3, t / 0.15) : t < 0.25 ? lerp(1.3, -2, (t - 0.15) / 0.1) : lerp(-2, 0.9, Math.min(1, (t - 0.25) / 0.3) ** 2);
      if (isPlayer && h.charge > 0) a.hammer.rotation.z = 1.3 + Math.sin(time * 18) * Math.min(0.05, h.charge * 0.05);
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
  // A tired beast's nest: a ring of twigs round a bed of hay.
  const nest = new T.Group(); scene.add(nest);
  const nestGeo = new T.TorusGeometry(1.55, 0.42, 7, 22); nestGeo.rotateX(Math.PI / 2);
  const twigMat = fluffy(toon(0x8a6643, furStrokes), 0.12), nestHayMat = noOutline(toon(0xdcb767, furStrokes)); materials.add(twigMat); materials.add(nestHayMat);
  mesh(nest, nestGeo, twigMat, [0, 0.2, 0], [1, 0.6, 1]); mesh(nest, circleGeo, nestHayMat, [0, 0.14, 0], [1.4, 1, 1.4], false);
  // Loose twigs criss-cross the rim, poking out at fixed, hand-picked angles.
  const twigGeo = new T.CylinderGeometry(0.05, 0.07, 1.5, 5); twigGeo.rotateZ(Math.PI / 2);
  const stickMat = toon(0x6b4a2c), twigs = new T.InstancedMesh(twigGeo, stickMat, 14); nest.add(twigs);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + (i % 3) * 0.13, r = 1.5 + (i % 2) * 0.22;
    quat.setFromEuler(new T.Euler((i % 4 - 1.5) * 0.18, -a + (i % 2 ? 0.7 : -0.6), (i % 3 - 1) * 0.2));
    matrix.compose(V(Math.cos(a) * r, 0.36 + (i % 3) * 0.06, Math.sin(a) * r), quat, V(0.8 + (i % 5) * 0.08, 1, 1)); twigs.setMatrixAt(i, matrix);
  }
  function label(text: string, color: string) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const ctx = c.getContext('2d'); if (ctx) { ctx.font = 'bold 58px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.fillText(text, 128, 70); }
    const map = new T.CanvasTexture(c); textures.add(map);
    const mat = noOutline(new T.SpriteMaterial({ map, transparent: true, depthWrite: false })); materials.add(mat);
    const sprite = new T.Sprite(mat); sprite.scale.set(1.8, 0.7, 1); scene.add(sprite); return sprite;
  }
  const hopLabel = label('hop!', '#fff4cf'), shakeMark = label('〰!', '#f39a31');
  // A speech bubble over the shopkeeper in talking reach.
  const talkBubble = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff9eb'; ctx.strokeStyle = '#6e4423'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.roundRect(8, 8, 240, 84, 30); ctx.moveTo(112, 92); ctx.lineTo(128, 120); ctx.lineTo(146, 92); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff9eb'; ctx.fillRect(114, 86, 30, 9);
      ctx.font = '900 46px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#43352d'; ctx.fillText('F · Talk', 128, 66);
    }
    const map = new T.CanvasTexture(c); map.colorSpace = T.SRGBColorSpace; textures.add(map);
    const mat = noOutline(new T.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false })); materials.add(mat);
    const sprite = new T.Sprite(mat); sprite.scale.set(1.3, 0.65, 1); sprite.renderOrder = 5; sprite.visible = false; scene.add(sprite); return sprite;
  })();
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  function resize() { if (closed) return; const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ray = new T.Raycaster(), cameraAim = V(), desired = V(), segment = V();
  let lastVariantColor = '';
  let lastRide = { riding: false, fullBonks: 0, bucking: false }, lastGame: HuntGame | null = null;
  // The rack and Forge preview: the hero on a little grass stand, swaying slowly and swinging the weapon every few seconds.
  const showBg = new T.Color(0xf6ead2), stand = new T.Group(); let showTime = 0; stand.visible = false; scene.add(stand);
  if (preview) { mesh(stand, new T.CylinderGeometry(1.2, 1.1, 0.22, 32), toon(0x9a6b44), [0, -0.12, 0], [1, 1, 1], false); mesh(stand, new T.CylinderGeometry(1.22, 1.22, 0.06, 32), toon(0x8cc152), [0, -0.02, 0], [1, 1, 1], false); }
  const showSwing = () => { const c = showTime % 3.2; return !reduced.matches && c >= 2 && c < 2.6 ? c - 2 : -1; };
  function draw(game: HuntGame, dt: number) {
    lastVariantColor = game.variant && game.beast ? VARIANT_COLORS[game.beast.id] : '';
    lastGame = game; lastRide = { riding: game.ride.riding, fullBonks: game.ride.fullBonks, bucking: game.ride.riding && game.ride.phase !== 'quiet' };
    if (closed) return;
    const worldKey = `${game.profile.hunts}:${game.mode === 'village' || game.mode === 'camp'}`;
    if (worldKey !== currentWorld) { currentWorld = worldKey; buildWorld(game); }
    village.visible = paths.visible = game.mode === 'village' || game.mode === 'camp'; campPath.visible = !village.visible;
    poseActor('dora', game); poseActor('enzo', game); holdFx(game, dt);
    for (const id of BEAST_IDS) beasts[id].root.visible = (game.beast?.id === id || game.visitor?.id === id && game.mode === 'hunt') && !['village', 'camp'].includes(game.mode);
    ambientLife(game.time);
    const weather = game.mode === 'hunt' || game.mode === 'nap' ? game.weather : { kind: 'clear' as WeatherKind, level: 0 }, wl = weather.level;
    // Fog and light follow the weather even with reduced motion; only the falling and drifting bits stop.
    const [fogColor, fogNear, fogFar] = WEATHER_FOG[weather.kind], fog = scene.fog as T.Fog;
    fogTarget.set(fogColor); fog.color.copy(baseFog).lerp(fogTarget, wl); fog.near = lerp(22, fogNear, wl); fog.far = lerp(86, fogFar, wl);
    skyLight.intensity = 1.4 * (1 - 0.22 * wl); sun.intensity = 1.8 * (1 - 0.45 * wl);
    snowfall.visible = currentArea === 'peak' && !reduced.matches;
    if (snowfall.visible) {
      const flakes = weather.kind === 'blizzard' ? Math.round(FLAKES + (BLIZZARD - FLAKES) * wl) : FLAKES, fall = 0.7 + wl * 2.4; snowfall.count = flakes;
      for (let i = 0; i < flakes; i++) { const x = Math.sin(i * 7.3) * 22, z = Math.cos(i * 3.7) * 22, f = (game.time * fall * (0.8 + (i % 5) * 0.1) + i * 0.37) % 9, y = 9 - f; matrix.compose(V(x + Math.sin(game.time + i) * 0.3 + wl * f * 1.6, y, z + wl * f * 0.5), upright, V(0.07, 0.07, 0.07)); snowfall.setMatrixAt(i, matrix); }
      snowfall.instanceMatrix.needsUpdate = true;
    }
    rain.visible = weather.kind === 'rain' && wl > 0.01 && !reduced.matches;
    if (rain.visible) {
      const drops = Math.round(RAIN * wl), cx = game.hero.x, cz = game.hero.z; rain.count = drops; slant.setFromAxisAngle(V(0, 0, 1), -0.18);
      for (let i = 0; i < drops; i++) { const f = (game.time * (16 + (i % 7)) + i * 1.37) % 13, x = cx + Math.sin(i * 12.9898) * 17 + f * 0.18, z = cz + Math.cos(i * 78.233) * 17; matrix.compose(V(x, 13 - f, z), slant, V(1, 1, 1)); rain.setMatrixAt(i, matrix); }
      rain.instanceMatrix.needsUpdate = true;
    }
    dust.visible = weather.kind === 'dust' && wl > 0.01 && !reduced.matches;
    if (dust.visible) {
      const motes = Math.round(DUST * wl); dust.count = motes;
      for (let i = 0; i < motes; i++) { const x = ((i * 7.13 + game.time * (5 + (i % 4))) % 44) - 22, y = 0.3 + (i % 9) * 0.45 + Math.sin(game.time * 2 + i) * 0.2, z = Math.sin(i * 3.31) * 20; matrix.compose(V(x, y, z), upright, V(0.05 + (i % 3) * 0.03, 0.05 + (i % 3) * 0.03, 0.05 + (i % 3) * 0.03)); dust.setMatrixAt(i, matrix); }
      dust.instanceMatrix.needsUpdate = true;
    }
    const talkTo = village.visible && game.mode === 'village' ? game.nearestSpot()?.id : undefined;
    talkBubble.visible = false;
    chimneyPuffs.forEach((o, i) => {
      const f = ((reduced.matches ? 0.4 : game.time * 0.3) + i / chimneyPuffs.length) % 1, c = chimneyAt[0];
      o.position.set(c.x + f * 0.7 + Math.sin(f * 6 + i) * 0.12, c.y + f * 2.4, c.z - f * 0.2); o.scale.setScalar((0.16 + f * 0.42) * Math.min(1, (1 - f) * 4));
    });
    for (const v of villagers) {
      if (v.spot === talkTo) { talkBubble.visible = true; talkBubble.position.set(v.x, v.top + 0.55 + (reduced.matches ? 0 : Math.sin(game.time * 3) * 0.06), v.z); }
      const near = Math.hypot(game.hero.x - v.x, game.hero.z - v.z) < 5, r = v.rig.root;
      v.rig.animate(game.time, near, reduced.matches);
      // Villagers face the paths, and turn to watch the leader who comes to talk.
      const want = near && !reduced.matches ? Math.atan2(game.hero.x - v.x, game.hero.z - v.z) : v.face, turnBy = Math.atan2(Math.sin(want - r.rotation.y), Math.cos(want - r.rotation.y));
      r.rotation.y += turnBy * Math.min(1, dt * 4);
    }
    const b = game.beast;
    const rock = game.hopRock();
    hopRing.visible = hopLabel.visible = !!rock;
    if (rock) { hopRing.position.set(rock.x, 0.12, rock.z); hopRing.scale.set(rock.r + 0.4, 1, rock.r + 0.4); hopLabel.position.set(rock.x, 1.6, rock.z); }
    shakeMark.visible = !!b && game.ride.riding && game.ride.phase !== 'quiet';
    if (b) shakeMark.position.set(b.x, b.height + 3.4, b.z);
    if (b) {
      const r = beasts[b.id], motion = reduced.matches ? 0 : Math.sin(game.time * 8);
      const softGlow = b.soft > 0 ? 0.35 + (reduced.matches ? 0 : Math.sin(game.time * 6) * 0.15) : 0;
      r.root.traverse((o) => { if (o instanceof T.Mesh && o.material instanceof T.MeshToonMaterial && o.material.userData.beastColor) { o.material.color.set(game.variant ? VARIANT_COLORS[b.id] : o.material.userData.beastColor); o.material.emissive.setHex(0xff7a3c); o.material.emissiveIntensity = softGlow; } });
      r.root.position.set(b.x, b.height, b.z); r.root.rotation.y = b.face;
      const napping = b.state === 'nap', snoozing = b.state === 'snooze', trudging = b.state === 'trudge', nap = napping ? Math.min(1, b.t / 1.6) : snoozing ? Math.min(1, b.t / 0.8) * 0.8 : 0;
      r.body.rotation.z = napping || snoozing ? nap * 0.28 : trudging ? -0.1 + (reduced.matches ? 0 : Math.sin(game.time * 4) * 0.05) : b.state === 'roar' ? 0.3 * Math.min(1, b.t / 0.15) + (reduced.matches ? 0 : Math.sin(game.time * 40) * 0.03) : b.state === 'windup' && b.attack === 'roar' ? -0.1 * Math.min(1, b.t / 0.5) : b.state === 'grabbed' && !reduced.matches ? Math.sin(game.time * 14) * 0.08 : b.state === 'yanked' ? -0.25 : b.state === 'windup' ? -0.12 * Math.sin(b.t * 12) : b.state === 'dizzy' ? Math.sin(game.time * 4) * 0.07 : b.state === 'stuck' && !reduced.matches ? Math.sin(game.time * 11) * 0.05 : 0;
      r.body.rotation.x = game.ride.plopped > 0 ? 1.25 * Math.min(1, (2 - game.ride.plopped) / 0.25, game.ride.plopped / 0.35) : 0;
      if (game.ride.riding && game.ride.phase === 'buck' && !reduced.matches) r.body.rotation.z = Math.sin(game.time * 22) * 0.3;
      r.body.rotation.y = b.state === 'sweep' ? Math.sin(Math.min(1, b.t / Math.max(0.01, b.duration)) * Math.PI) * 1.35 : 0;
      const pulse = b.flash > 0 ? Math.sin(b.flash * 25) * 0.08 : 0;
      const gone = napping ? 1 - T.MathUtils.smoothstep(b.t, 2.7, 3.2) : 1;
      r.root.scale.setScalar(Math.max(0.001, gone) * (game.huntChapter === 0 ? 0.55 : 1)); const puff = b.state === 'roar' ? 0.12 * Math.sin(Math.min(1, b.t / 1.1) * Math.PI) : 0;
      r.body.scale.set(1 + nap * 0.12 + pulse + puff, 1 - nap * 0.42 - pulse + puff + (snoozing && !reduced.matches ? Math.sin(game.time * 2.2) * 0.035 : 0), 1 + nap * 0.16 + pulse + puff);
      if (game.ride.riding && game.ride.phase === 'warning') { r.body.scale.y *= 0.86; r.body.scale.x *= 1.06; }
      r.legs.forEach((leg, i) => { leg.rotation.z = nap * -0.9 + (!napping && ['roam', 'charge', 'pounce', 'hop'].includes(b.state) ? motion * (i % 2 ? 0.3 : -0.3) : trudging && !reduced.matches ? Math.sin(game.time * 4) * (i % 2 ? 0.4 : -0.4) : 0); });
      if (b.id === 'bristleback' && b.state === 'windup' && !reduced.matches) r.legs[2].rotation.z = Math.sin(game.time * 16) * 0.55;
      r.eyes.forEach((eye) => { eye.scale.y = nap > 0 ? Math.max(0.02, 0.15 * (1 - nap)) : 0.12; });
      r.part.visible = !b.broken;
      r.wings.forEach((wing, i) => { wing.rotation.x = b.state === 'circle' || b.state === 'swoop' ? Math.sin(game.time * 9) * (i ? -0.9 : 0.9) : 0; });
      if (r.throat) { const sac = b.broken ? 0.72 : 1; r.throat.scale.set((0.9 + (b.attack === 'cloud' && b.state === 'windup' ? b.t * 0.5 : Math.sin(game.time * 2) * 0.035)) * sac, 0.8 * sac, 1.05 * sac); }
      if (r.tongue) { r.tongue.visible = b.state === 'tongue'; const length = 0.1 + Math.sin(Math.min(1, b.t / Math.max(0.01, b.duration)) * Math.PI) * 5.4; r.tongue.scale.y = length; r.tongue.position.x = 1.4 + length / 2; }
      if (r.mane) { r.mane.rotation.x = b.state === 'shake' ? Math.sin(game.time * 30) * 0.22 : 0; r.mane.scale.setScalar(1 + (b.phase - 1) * 0.08); }
      const steaming = b.grumpy && !napping && !snoozing;
      r.brow.color.copy(steaming ? grumpyRed : r.browColor);
      r.steam.forEach((puff, i) => {
        puff.visible = steaming; if (!steaming) return;
        // Each puff rises, swells and vanishes in a 1.2 s loop, staggered across the three per ear.
        const f = reduced.matches ? 0.35 + (i % 3) * 0.2 : (game.time / 1.2 + (i % 3) / 3) % 1, home = puff.userData.home ??= puff.position.clone();
        puff.position.set(home.x - f * 0.2, home.y + f * 0.9, home.z * (1 + f * 0.3)); puff.scale.setScalar((0.08 + f * 0.17) * Math.min(1, (1 - f) * 4));
      });
    }
    nest.visible = !!b && game.huntChapter !== 0 && (game.mode === 'hunt' || game.mode === 'nap'); nest.position.set(game.nest.x, 0, game.nest.z);
    // A visiting beast walks in and squares off; it is never the hunted beast, so its rig is free.
    const v = game.visitor;
    if (v && game.mode === 'hunt') {
      const r = beasts[v.id], walk = v.state !== 'face' && !reduced.matches ? Math.sin(game.time * 8) : 0, flying = v.id === 'skreel';
      r.root.traverse((o) => { if (o instanceof T.Mesh && o.material instanceof T.MeshToonMaterial && o.material.userData.beastColor) o.material.color.set(o.material.userData.beastColor); });
      r.root.position.set(v.x, flying ? 1.2 + (reduced.matches ? 0 : Math.sin(game.time * 3) * 0.15) : 0, v.z); r.root.rotation.y = v.face; r.root.scale.setScalar(1);
      r.body.rotation.set(0, 0, v.state === 'face' && !reduced.matches ? -0.12 * Math.sin(game.time * 12) : 0); r.body.scale.set(1, 1, 1);
      r.legs.forEach((leg, i) => { leg.rotation.z = walk * (i % 2 ? 0.3 : -0.3); }); r.eyes.forEach((eye) => { eye.scale.y = 0.12; }); r.part.visible = true;
      r.wings.forEach((wing, i) => { wing.rotation.x = flying && !reduced.matches ? Math.sin(game.time * 9) * (i ? -0.9 : 0.9) : 0; });
      if (r.tongue) r.tongue.visible = false; r.steam.forEach((puff) => { puff.visible = false; }); r.brow.color.copy(r.browColor);
    }
    vineLine.visible = !!game.vine && !!b && game.mode === 'hunt';
    if (vineLine.visible && b) {
      const h = game.hero, reachF = game.vine!.phase === 'fly' ? Math.min(1, game.vine!.t / 0.25) : 1, head = 1.6;
      vineFrom.set(h.x, (game.vine!.phase === 'cling' ? 1.15 : 0) + 0.9, h.z); vineTo.set(b.x + Math.cos(b.face) * head, b.height + 1.4, b.z - Math.sin(b.face) * head);
      vineDir.subVectors(vineTo, vineFrom); const length = Math.max(0.01, vineDir.length() * reachF);
      vineLine.position.copy(vineFrom); vineLine.quaternion.setFromUnitVectors(V(0, 1, 0), vineDir.normalize()); vineLine.scale.set(1, length, 1);
    }
    const turf = b?.state === 'turf' && !!v;
    const warning = b?.state === 'windup';
    const round = b && ['sweep', 'shake', 'cloud', 'roar'].includes(b.attack);
    lane.visible = !!warning && !round; circle.visible = !!warning && !!round || turf;
    if (turf) { circle.position.set((b!.x + v!.x) / 2, 0.08, (b!.z + v!.z) / 2); circle.scale.set(TURF_REACH, 1, TURF_REACH); }
    icyRing.visible = b?.state === 'shake'; if (b) { const size = 1 + Math.min(1, b.t / Math.max(0.01, b.duration)) * 4; icyRing.position.set(b.x, 0.09, b.z); icyRing.scale.set(size, 1, size); }
    const roaring = b?.state === 'roar';
    roarRings.forEach((o, i) => { const f = roaring ? (b!.t - i * 0.18) / 0.7 : -1; o.visible = f > 0 && f < 1; if (o.visible) { const size = 1.5 + f * (ROAR_REACH + 1); o.position.set(b!.x, b!.height + 0.6 + f * 0.4, b!.z); o.scale.set(size, 1, size); } });
    roarMat.opacity = roaring ? 0.7 * Math.max(0, 1 - b!.t / 1.1) + 0.15 : 0;
    markerMat.opacity = reduced.matches ? 0.48 : 0.3 + Math.sin(game.time * 13) * 0.12 + 0.1;
    if (b && warning) {
      if (round) { const size = b.attack === 'roar' ? ROAR_REACH : b.attack === 'shake' ? 5 : b.attack === 'cloud' ? 3.5 : 4; circle.position.set(b.x + (b.attack === 'cloud' ? b.dir.x * 3 : 0), 0.08, b.z + (b.attack === 'cloud' ? b.dir.z * 3 : 0)); circle.scale.set(size, 1, size); }
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
    drowsy.forEach((o, i) => { const snooze = b?.state === 'snooze', on = !!b && (b.drowsy > 0 || snooze) && b.state !== 'nap'; o.visible = on; if (on) { const f = reduced.matches ? 0.3 + i * 0.25 : (game.time / 1.8 + i / 3) % 1; o.position.set(b!.x + f * 0.6, b!.height + (snooze ? 2.2 : 3) + f * 1.4, b!.z + Math.sin(f * 6) * 0.3); o.scale.setScalar((0.1 + f * 0.12) * (snooze ? 1.6 : 1)); } });
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
      root.position.set(0, 0, 0); root.rotation.y = -0.25 + (reduced.matches ? 0 : Math.sin(showTime * 0.7) * 0.35);
      for (const o of scene.children) o.visible = o === root || o === stand || o instanceof T.Light || o === sun.target;
      stand.visible = true; scene.background = showBg; target.set(0, 0.72, 0); camera.position.set(1.65, 1.0, 1.8);
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
        canopyShown[i] = Math.max(0, Math.min(1, canopyShown[i] + (blocking ? -dt : dt) / 0.2));
      });
      placeCanopies();
    }
    wind.value = reduced.matches ? 0 : game.time;
    push.value.set(game.hero.x, game.hero.z, game.buddy.x, game.buddy.z);
    const presser = game.mode === 'hunt' && game.beast && game.beast.height < 0.5 ? game.beast : null;
    beastPush.value.set(presser?.x ?? 0, presser?.z ?? 99, presser ? 1.6 : 0.01);
    renderer.info.reset();
    outline.render(scene, camera);
    if (++frame === 2) ready();
  }
  return {
    draw,
    get yaw() { return yaw; },
    orbit(dx: number, dy: number) { yaw -= dx * 0.006; pitch = T.MathUtils.clamp(pitch + dy * 0.004, 0.18, 0.95); userOrbit = 4; },
    zoom(delta: number) { dist = T.MathUtils.clamp(dist + delta * 0.008, 5, 14); },
    metrics() { const game = lastGame; return { area: currentArea, villagers: village.visible ? villagers.length : 0, variantColor: lastVariantColor, ride: { riding: lastRide.riding, fullBonks: lastRide.fullBonks, bucking: lastRide.bucking }, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, camera: camera.position.toArray(), pixelRatio: renderer.getPixelRatio(), textures: renderer.info.memory.textures, hiddenCanopies: canopyShown.filter((v) => v < 0.5).length, pawprints: pawprints.count, spots: spotRigs.filter((r) => r.root.visible && r.fruit.visible).length, drops: dropSprites.filter((o) => o.visible).length, trap: sap.visible, smoke: smoke[0].visible, steam: BEAST_IDS.some((id) => beasts[id].root.visible && beasts[id].steam[0].visible), nest: nest.visible, sleepy: drowsy[0].visible, roarRings: roarRings.filter((o) => o.visible).length, visitor: !!game?.visitor && beasts[game.visitor.id].root.visible, vine: vineLine.visible, soft: !!game?.beast && game.beast.soft > 0, turfCircle: game?.beast?.state === 'turf' && circle.visible, weather: { rain: rain.visible ? rain.count : 0, dust: dust.visible ? dust.count : 0, flakes: snowfall.visible ? snowfall.count : 0, fogFar: Math.round((scene.fog as T.Fog).far) } }; },
    dispose() {
      if (closed) return; closed = true; observer.disconnect();
      scene.traverse((o) => { if (o instanceof T.InstancedMesh) o.dispose(); if (o instanceof T.Mesh || o instanceof T.Line) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
      for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of textures) t.dispose();
      sun.shadow.map?.dispose(); renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss(); scene.clear();
    },
  };
}
export type HuntScene = ReturnType<typeof createHuntScene>;
