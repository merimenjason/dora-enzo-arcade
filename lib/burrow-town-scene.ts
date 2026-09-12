// Three.js view of Burrow Town. Reads the engine every frame and rebuilds only
// the tiles whose contents changed. Nothing here affects the rules.
import * as T from 'three';
import { createChinchilla, animateChinchilla, type Chinchilla } from './chinchilla';
import { BurrowTown, HOUSING, W, H, type BuildingId, type Tile } from './burrow-town-game';

const TILE = 1;
const ox = -W / 2 + 0.5;
const oz = -H / 2 + 0.5;
const HEIGHT = { grass: 0.3, terrace: 0.46, rock: 0.62, river: 0.1 } as const;
const world = (x: number, y: number) => new T.Vector3((x + ox) * TILE, 0, (y + oz) * TILE);

let seed = 3;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const mat = (color: number, extra: Partial<T.MeshStandardMaterialParameters> = {}) => new T.MeshStandardMaterial({ color, roughness: 0.92, ...extra });
const M = {
  grass: mat(0x8fb56a),
  grassDark: mat(0x7ea45c),
  terrace: mat(0xa9c07a),
  terraceWall: mat(0xb59c78),
  rock: mat(0x8d8a86),
  rockDark: mat(0x6f6b68),
  river: new T.MeshStandardMaterial({ color: 0x5aa7d6, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9 }),
  dirt: mat(0x7a5d44),
  road: mat(0xcbb48d),
  roadEdge: mat(0xb39d78),
  wood: mat(0x9a6b45),
  woodLight: mat(0xc99a6a),
  stone: mat(0xb7b0a4),
  stoneDark: mat(0x8c857a),
  hay: mat(0xe3c46a),
  hayDark: mat(0xc9a94f),
  clay: mat(0xc98a63),
  cream: mat(0xf1e6d2),
  cloth: mat(0xd9634f),
  clothPale: mat(0xf3e9d8),
  leaf: mat(0x5f9a53),
  dust: new T.MeshStandardMaterial({ color: 0xe8dcc6, transparent: true, opacity: 0.55, roughness: 1 }),
  door: mat(0x3b2a20),
  window: new T.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffb347, emissiveIntensity: 0 }),
  lamp: new T.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffc866, emissiveIntensity: 0 }),
  metal: mat(0x6e7378, { metalness: 0.4, roughness: 0.5 }),
  ghostOk: new T.MeshBasicMaterial({ color: 0x8be08a, transparent: true, opacity: 0.45, depthWrite: false }),
  ghostBad: new T.MeshBasicMaterial({ color: 0xe0705f, transparent: true, opacity: 0.45, depthWrite: false }),
  ruin: mat(0x9a9086),
  ruinDark: mat(0x6f665e),
  flowers: [mat(0xf28cb0), mat(0xf7d15c), mat(0xffffff), mat(0xb79ae0)],
};
/** Grass colours by season, so a dry day reads at a glance. */
const GREEN = { grass: new T.Color(0x8fb56a), grassDark: new T.Color(0x7ea45c), terrace: new T.Color(0xa9c07a) };
const STRAW = { grass: new T.Color(0xbcb06a), grassDark: new T.Color(0xa89c5c), terrace: new T.Color(0xc8bf7e) };
const G = {
  box: new T.BoxGeometry(1, 1, 1),
  sphere: new T.SphereGeometry(1, 16, 12),
  cyl: new T.CylinderGeometry(1, 1, 1, 14),
  cone: new T.ConeGeometry(1, 1, 14),
  dodeca: new T.DodecahedronGeometry(1, 0),
  torus: new T.TorusGeometry(1, 0.18, 8, 24),
};

function part(parent: T.Object3D, geo: T.BufferGeometry, m: T.Material, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]) {
  const mesh = new T.Mesh(geo, m);
  mesh.position.set(...pos);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rot);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Ground tile: a coloured block whose height shows the terrain. */
function terrainMesh(t: Tile): T.Group {
  const g = new T.Group();
  const h = HEIGHT[t.t];
  if (t.t === 'river') {
    part(g, G.box, M.dirt, [0, h / 2 - 0.02, 0], [TILE, h, TILE]).castShadow = false;
    const water = part(g, G.box, M.river, [0, h - 0.04, 0], [TILE, 0.08, TILE]);
    water.castShadow = false;
    water.userData.water = true;
  } else if (t.t === 'rock') {
    part(g, G.box, M.rockDark, [0, 0.2, 0], [TILE, 0.4, TILE]);
    part(g, G.box, M.rock, [0, h - 0.11, 0], [TILE, 0.22, TILE]);
    for (let i = 0; i < 3; i++) part(g, G.dodeca, i ? M.rock : M.stoneDark, [(rnd() - 0.5) * 0.5, h + 0.05 + rnd() * 0.08, (rnd() - 0.5) * 0.5], [0.16 + rnd() * 0.1, 0.12 + rnd() * 0.12, 0.16 + rnd() * 0.1], [rnd(), rnd() * 3, rnd()]);
  } else if (t.t === 'terrace') {
    part(g, G.box, M.terraceWall, [0, (h - 0.06) / 2, 0], [TILE, h - 0.06, TILE]);
    part(g, G.box, M.terrace, [0, h - 0.03, 0], [TILE * 0.96, 0.06, TILE * 0.96]);
  } else {
    part(g, G.box, M.dirt, [0, (h - 0.05) / 2, 0], [TILE, h - 0.05, TILE]).castShadow = false;
    part(g, G.box, (t.x + t.y) % 2 ? M.grass : M.grassDark, [0, h - 0.025, 0], [TILE, 0.05, TILE]);
    if (rnd() < 0.18) part(g, G.cone, M.leaf, [(rnd() - 0.5) * 0.6, h + 0.06, (rnd() - 0.5) * 0.6], [0.05, 0.12, 0.05]);
  }
  return g;
}

/** Road tile shaped by which neighbours it joins. mask bits: 1 east, 2 west, 4 south, 8 north. */
function roadMesh(mask: number, bridge: boolean, h: number): T.Group {
  const g = new T.Group();
  const m = bridge ? M.wood : M.road;
  const y = bridge ? HEIGHT.grass + 0.02 : h + 0.012;
  const core = part(g, G.box, m, [0, y, 0], [0.5, bridge ? 0.06 : 0.025, 0.5]);
  core.castShadow = false;
  const arms: [number, number, number][] = [
    [1, 0.25, 0],
    [2, -0.25, 0],
    [4, 0, 0.25],
    [8, 0, -0.25],
  ];
  for (const [bit, dx, dz] of arms) {
    if (!(mask & bit)) continue;
    const arm = part(g, G.box, m, [dx, y, dz], [dx ? 0.5 : 0.5, bridge ? 0.06 : 0.025, dz ? 0.5 : 0.5]);
    arm.castShadow = false;
  }
  if (bridge) {
    for (const s of [-0.28, 0.28]) {
      part(g, G.box, M.woodLight, [mask & 3 ? 0 : s, y + 0.1, mask & 3 ? s : 0], mask & 3 ? [1, 0.03, 0.04] : [0.04, 0.03, 1]);
      part(g, G.box, M.wood, [mask & 3 ? -0.4 : s, y + 0.06, mask & 3 ? s : -0.4], [0.05, 0.12, 0.05]);
      part(g, G.box, M.wood, [mask & 3 ? 0.4 : s, y + 0.06, mask & 3 ? s : 0.4], [0.05, 0.12, 0.05]);
    }
  } else if (!mask) {
    core.scale.set(0.6, 0.025, 0.6);
  }
  return g;
}

/** Build the model for a building on a tile. Occupied homes get a lit door. */
function buildingMesh(id: BuildingId, t: Tile, h: number, ruin = false): T.Group {
  const g = new T.Group();
  g.position.y = h;
  const lamps: T.Mesh[] = [];
  switch (id) {
    case 'burrow': {
      part(g, G.sphere, M.dirt, [0, 0, 0], [0.4, 0.28, 0.4]);
      part(g, G.sphere, M.grass, [0, 0.02, 0], [0.41, 0.26, 0.41]).position.y = -0.03;
      part(g, G.sphere, M.dirt, [0.04, 0.03, 0.1], [0.36, 0.24, 0.34]);
      part(g, G.cyl, M.door, [0, 0.09, 0.34], [0.11, 0.06, 0.11], [Math.PI / 2, 0, 0]);
      part(g, G.cyl, M.window, [0, 0.09, 0.345], [0.06, 0.05, 0.06], [Math.PI / 2, 0, 0]);
      part(g, G.cyl, M.clay, [-0.16, 0.28, -0.08], [0.04, 0.16, 0.04]);
      break;
    }
    case 'bigburrow': {
      part(g, G.sphere, M.dirt, [-0.14, 0, 0.05], [0.34, 0.34, 0.34]);
      part(g, G.sphere, M.dirt, [0.18, 0, -0.08], [0.3, 0.26, 0.3]);
      part(g, G.sphere, M.grass, [-0.14, 0.03, 0.05], [0.33, 0.3, 0.33]);
      part(g, G.sphere, M.grass, [0.18, 0.02, -0.08], [0.29, 0.23, 0.29]);
      part(g, G.box, M.wood, [-0.14, 0.12, 0.37], [0.22, 0.2, 0.04]);
      part(g, G.box, M.window, [-0.14, 0.13, 0.4], [0.1, 0.12, 0.02]);
      part(g, G.box, M.window, [0.18, 0.1, 0.2], [0.08, 0.08, 0.02]);
      part(g, G.cyl, M.clay, [0.24, 0.3, -0.18], [0.045, 0.2, 0.045]);
      part(g, G.cyl, M.clay, [-0.3, 0.32, -0.06], [0.045, 0.2, 0.045]);
      break;
    }
    case 'hayfarm': {
      part(g, G.box, M.dirt, [0, 0.012, 0], [0.92, 0.025, 0.92]).castShadow = false;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) part(g, G.cone, r % 2 ? M.hay : M.hayDark, [-0.34 + c * 0.226, 0.13, -0.34 + r * 0.226], [0.07, 0.22 + ((r + c) % 3) * 0.03, 0.07]);
      part(g, G.cyl, M.hay, [0.36, 0.1, 0.36], [0.09, 0.14, 0.09], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'dustbath': {
      part(g, G.cyl, M.stone, [0, 0.05, 0], [0.42, 0.1, 0.42]);
      part(g, G.cyl, M.dust, [0, 0.09, 0], [0.34, 0.06, 0.34]);
      for (let i = 0; i < 5; i++) {
        const p = part(g, G.sphere, M.dust, [(rnd() - 0.5) * 0.4, 0.2 + rnd() * 0.15, (rnd() - 0.5) * 0.4], [0.07 + rnd() * 0.05, 0.06, 0.07]);
        p.castShadow = false;
        p.userData.puff = rnd() * 6;
      }
      break;
    }
    case 'garden': {
      part(g, G.box, M.grassDark, [0, 0.015, 0], [0.9, 0.03, 0.9]).castShadow = false;
      part(g, G.box, M.wood, [0, 0.04, 0], [0.9, 0.05, 0.05]);
      part(g, G.box, M.wood, [0, 0.04, 0], [0.05, 0.05, 0.9]);
      for (let i = 0; i < 12; i++) {
        const x = (rnd() - 0.5) * 0.78;
        const z = (rnd() - 0.5) * 0.78;
        if (Math.abs(x) < 0.06 || Math.abs(z) < 0.06) continue;
        part(g, G.cyl, M.leaf, [x, 0.08, z], [0.012, 0.14, 0.012]);
        part(g, G.sphere, M.flowers[i % 4], [x, 0.16, z], [0.045, 0.04, 0.045]);
      }
      part(g, G.sphere, M.leaf, [0.3, 0.16, -0.3], [0.13, 0.15, 0.13]);
      break;
    }
    case 'plaza': {
      part(g, G.box, M.stone, [0, 0.02, 0], [0.98, 0.04, 0.98]).castShadow = false;
      part(g, G.cyl, M.stoneDark, [0, 0.07, 0], [0.32, 0.08, 0.32]);
      part(g, G.cyl, M.river, [0, 0.11, 0], [0.26, 0.02, 0.26]).castShadow = false;
      part(g, G.cyl, M.stone, [0, 0.22, 0], [0.05, 0.28, 0.05]);
      part(g, G.cyl, M.stone, [0, 0.36, 0], [0.13, 0.03, 0.13]);
      const drop = part(g, G.sphere, M.river, [0, 0.42, 0], [0.04, 0.06, 0.04]);
      drop.userData.puff = 1;
      for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]] as const) {
        part(g, G.cyl, M.metal, [x, 0.22, z], [0.02, 0.44, 0.02]);
        lamps.push(part(g, G.sphere, M.lamp, [x, 0.47, z], [0.055, 0.055, 0.055]));
      }
      break;
    }
    case 'quarry': {
      part(g, G.box, M.stoneDark, [0, -0.1, 0], [0.7, 0.2, 0.7]);
      part(g, G.dodeca, M.rock, [-0.25, 0.1, -0.2], [0.18, 0.16, 0.18]);
      part(g, G.dodeca, M.stone, [0.22, 0.08, -0.24], [0.14, 0.12, 0.14]);
      part(g, G.box, M.wood, [0.2, 0.09, 0.22], [0.28, 0.12, 0.2]);
      part(g, G.cyl, M.metal, [0.08, 0.05, 0.34], [0.05, 0.03, 0.05], [Math.PI / 2, 0, 0]);
      part(g, G.cyl, M.metal, [0.32, 0.05, 0.34], [0.05, 0.03, 0.05], [Math.PI / 2, 0, 0]);
      part(g, G.sphere, M.rock, [0.2, 0.17, 0.22], [0.09, 0.05, 0.08]);
      part(g, G.cyl, M.wood, [-0.28, 0.2, 0.25], [0.025, 0.4, 0.025], [0, 0, 0.5]);
      part(g, G.box, M.metal, [-0.14, 0.34, 0.25], [0.12, 0.05, 0.05]);
      break;
    }
    case 'market': {
      part(g, G.box, M.stone, [0, 0.015, 0], [0.9, 0.03, 0.9]).castShadow = false;
      for (const [x, z] of [[-0.24, 0.22], [0.26, 0.22], [0.02, -0.26]] as const) {
        part(g, G.box, M.wood, [x, 0.1, z], [0.34, 0.16, 0.24]);
        part(g, G.box, M.hay, [x - 0.08, 0.2, z], [0.09, 0.05, 0.14]);
        part(g, G.box, M.flowers[1], [x + 0.08, 0.2, z], [0.09, 0.05, 0.14]);
        for (const s of [-0.15, 0.15]) part(g, G.cyl, M.wood, [x + s, 0.28, z], [0.015, 0.4, 0.015]);
        const awn = part(g, G.box, x < 0 ? M.cloth : M.clothPale, [x, 0.46, z], [0.4, 0.03, 0.3]);
        awn.rotation.x = 0.15;
        part(g, G.box, x < 0 ? M.clothPale : M.cloth, [x, 0.47, z - 0.09], [0.4, 0.03, 0.1]);
      }
      break;
    }
    case 'workshop': {
      part(g, G.box, M.clay, [0, 0.2, 0], [0.62, 0.4, 0.56]);
      part(g, G.box, M.wood, [0, 0.44, 0], [0.7, 0.08, 0.64]);
      part(g, G.box, M.woodLight, [0, 0.5, 0], [0.5, 0.06, 0.44]);
      part(g, G.cyl, M.stoneDark, [0.2, 0.62, -0.15], [0.06, 0.28, 0.06]);
      part(g, G.box, M.window, [0, 0.22, 0.29], [0.18, 0.14, 0.02]);
      part(g, G.box, M.door, [-0.22, 0.14, 0.29], [0.12, 0.28, 0.02]);
      const gear = part(g, G.torus, M.metal, [0.36, 0.28, 0.12], [0.12, 0.12, 0.12], [0, Math.PI / 2, 0]);
      gear.userData.spin = true;
      for (let i = 0; i < 6; i++) part(gear, G.box, M.metal, [Math.cos((i / 6) * Math.PI * 2) * 1.15, Math.sin((i / 6) * Math.PI * 2) * 1.15, 0], [0.3, 0.3, 1]);
      break;
    }
    case 'silo': {
      part(g, G.cyl, M.stoneDark, [0, 0.04, 0], [0.32, 0.08, 0.32]);
      part(g, G.cyl, M.woodLight, [0, 0.36, 0], [0.28, 0.62, 0.28]);
      for (const y of [0.16, 0.36, 0.56]) part(g, G.cyl, M.wood, [0, y, 0], [0.3, 0.035, 0.3]);
      part(g, G.cone, M.clay, [0, 0.78, 0], [0.34, 0.24, 0.34]);
      part(g, G.box, M.door, [0, 0.18, 0.29], [0.14, 0.24, 0.02]);
      part(g, G.box, M.hay, [0.36, 0.08, -0.24], [0.22, 0.16, 0.22]);
      break;
    }
    case 'watchtower': {
      part(g, G.cyl, M.stoneDark, [0, 0.08, 0], [0.3, 0.16, 0.3]);
      part(g, G.cyl, M.stone, [0, 0.5, 0], [0.2, 0.7, 0.22]);
      part(g, G.cyl, M.wood, [0, 0.9, 0], [0.3, 0.08, 0.3]);
      for (let i = 0; i < 4; i++) part(g, G.box, M.wood, [Math.cos((i / 4) * Math.PI * 2 + 0.78) * 0.26, 1.05, Math.sin((i / 4) * Math.PI * 2 + 0.78) * 0.26], [0.04, 0.24, 0.04]);
      part(g, G.cone, M.cloth, [0, 1.3, 0], [0.34, 0.28, 0.34]);
      lamps.push(part(g, G.sphere, M.lamp, [0, 1.02, 0], [0.09, 0.09, 0.09]));
      break;
    }
  }
  if (ruin) {
    // A derelict building: weathered grey, sunk and leaning, with nothing lit.
    g.traverse((o) => {
      if (o instanceof T.Mesh) o.material = rnd() < 0.5 ? M.ruin : M.ruinDark;
    });
    g.scale.set(0.88, 0.55, 0.88);
    g.rotation.z = (rnd() - 0.5) * 0.16;
    g.rotation.x = (rnd() - 0.5) * 0.12;
    part(g, G.cyl, M.wood, [0.34, 0.3, 0.3], [0.02, 0.6, 0.02], [0, 0, 0.4]);
    lamps.length = 0;
  }
  g.userData.lamps = lamps;
  g.userData.home = HOUSING.includes(id) && !ruin;
  g.userData.ruin = ruin;
  return g;
}

export type Overlay = 'none' | 'comfort' | 'links' | 'income';
export const OVERLAYS: Overlay[] = ['none', 'comfort', 'links', 'income'];

type Walker = { chin: Chinchilla; pivot: T.Group; from: T.Vector3; to: T.Vector3; tile: [number, number]; progress: number; speed: number; pause: number };
type Mini = { root: T.Group; from: T.Vector3; to: T.Vector3; tile: [number, number]; progress: number; pause: number };

export class BurrowTownScene {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(42, 1, 0.1, 200);
  renderer: T.WebGLRenderer;
  target = new T.Vector3(0, 0.3, 0);
  yaw = 0.62;
  pitch = 0.88;
  dist = 19;
  private ground = new T.Group();
  private built = new Map<number, { key: string; group: T.Group; born: number }>();
  private roads = new Map<number, { key: string; group: T.Group }>();
  private terrainKey = '';
  private ghost: T.Mesh;
  private sun: T.DirectionalLight;
  private hemi: T.HemisphereLight;
  private lights: T.PointLight[] = [];
  private walkers: Walker[] = [];
  private minis: Mini[] = [];
  /** Which data layer is painted over the valley, if any. */
  overlay: Overlay = 'none';
  private plates: T.Mesh[] = [];
  private overlayGroup = new T.Group();
  private pickPlane = new T.Plane(new T.Vector3(0, 1, 0), -HEIGHT.grass);
  private ray = new T.Raycaster();
  private sky = { day: new T.Color('#bfe0f2'), dusk: new T.Color('#f0b98a'), night: new T.Color('#233350') };
  private clock = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = this.sky.day.clone();
    this.scene.fog = new T.Fog(this.sky.day.clone(), 30, 70);
    this.hemi = new T.HemisphereLight(0xe9f4ff, 0x7c6a4c, 1.6);
    this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight(0xfff0d0, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -12;
    this.sun.shadow.camera.right = 12;
    this.sun.shadow.camera.top = 10;
    this.sun.shadow.camera.bottom = -10;
    this.sun.shadow.camera.far = 60;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun, this.sun.target);
    for (let i = 0; i < 6; i++) {
      const l = new T.PointLight(0xffb066, 0, 4.5, 2);
      l.visible = false;
      this.lights.push(l);
      this.scene.add(l);
    }
    this.scene.add(this.ground);
    this.ghost = new T.Mesh(new T.BoxGeometry(TILE * 0.98, 0.06, TILE * 0.98), M.ghostOk);
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.addSurroundings();
    for (const white of [true, false]) {
      const chin = createChinchilla(white);
      const pivot = new T.Group();
      chin.root.scale.setScalar(0.42);
      pivot.add(chin.root);
      this.scene.add(pivot);
      this.walkers.push({ chin, pivot, from: new T.Vector3(), to: new T.Vector3(), tile: [W >> 1, H >> 1], progress: 1, speed: white ? 0.75 : 0.9, pause: 0.5 });
    }
    this.resize();
  }

  /** Hills, far peaks and a dirt apron so the valley does not float in the sky. */
  private addSurroundings() {
    const apron = new T.Mesh(new T.BoxGeometry(W * TILE + 1.2, 1.2, H * TILE + 1.2), M.dirt);
    apron.position.y = -0.6;
    apron.receiveShadow = true;
    this.scene.add(apron);
    const meadow = new T.Mesh(new T.CylinderGeometry(40, 40, 0.4, 48), mat(0x86a95f));
    meadow.position.y = -0.42;
    meadow.receiveShadow = true;
    this.scene.add(meadow);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
      const r = 14 + rnd() * 10;
      const hill = new T.Mesh(G.sphere, i % 3 ? mat(0x7c9d57) : mat(0x6f8f4f));
      hill.position.set(Math.cos(a) * r, -1.2, Math.sin(a) * r);
      hill.scale.set(3 + rnd() * 4, 1.6 + rnd() * 2.2, 3 + rnd() * 3);
      hill.receiveShadow = true;
      this.scene.add(hill);
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rnd() * 0.3;
      const r = 34 + rnd() * 12;
      const peak = new T.Mesh(G.cone, mat(0x8fa0b3));
      peak.position.set(Math.cos(a) * r, 2 + rnd() * 2, Math.sin(a) * r);
      peak.scale.set(6 + rnd() * 6, 9 + rnd() * 9, 6 + rnd() * 6);
      this.scene.add(peak);
      const snow = new T.Mesh(G.cone, mat(0xf4f7fb));
      snow.position.set(peak.position.x, peak.position.y + peak.scale.y * 0.36, peak.position.z);
      snow.scale.set(peak.scale.x * 0.3, peak.scale.y * 0.3, peak.scale.z * 0.3);
      this.scene.add(snow);
    }
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 11 + rnd() * 9;
      const tree = new T.Group();
      tree.position.set(Math.cos(a) * r, -0.2, Math.sin(a) * r);
      part(tree, G.cyl, M.wood, [0, 0.35, 0], [0.08, 0.7, 0.08]);
      part(tree, G.cone, M.leaf, [0, 1.1, 0], [0.55, 1.3, 0.55]);
      this.scene.add(tree);
    }
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  /** Move the camera target across the ground, relative to the view direction. */
  pan(dx: number, dz: number) {
    const s = this.dist * 0.0016;
    const right = new T.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new T.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target.addScaledVector(right, dx * s).addScaledVector(fwd, dz * s);
    this.target.x = T.MathUtils.clamp(this.target.x, -W / 2, W / 2);
    this.target.z = T.MathUtils.clamp(this.target.z, -H / 2, H / 2);
  }
  rotate(d: number) {
    this.yaw += d;
  }
  zoom(d: number) {
    this.dist = T.MathUtils.clamp(this.dist * (1 + d), 7, 26);
  }
  /** Tile under a client point, or null off the board. */
  pick(clientX: number, clientY: number): [number, number] | null {
    const r = this.canvas.getBoundingClientRect();
    const p = new T.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(p, this.camera);
    const hit = new T.Vector3();
    if (!this.ray.ray.intersectPlane(this.pickPlane, hit)) return null;
    const x = Math.floor(hit.x / TILE - ox + 0.5);
    const y = Math.floor(hit.z / TILE - oz + 0.5);
    return x >= 0 && y >= 0 && x < W && y < H ? [x, y] : null;
  }
  setHover(tile: [number, number] | null, ok: boolean) {
    this.ghost.visible = !!tile;
    if (!tile) return;
    const p = world(tile[0], tile[1]);
    this.ghost.position.set(p.x, HEIGHT.grass + 0.42, p.z);
    this.ghost.material = ok ? M.ghostOk : M.ghostBad;
  }

  private tileHeight(t: Tile) {
    return HEIGHT[t.t];
  }
  private roadMask(g: BurrowTown, t: Tile) {
    let m = 0;
    const joins = (o: Tile | null) => !!o && (o.road || o.b === 'plaza');
    if (joins(g.tile(t.x + 1, t.y))) m |= 1;
    if (joins(g.tile(t.x - 1, t.y))) m |= 2;
    if (joins(g.tile(t.x, t.y + 1))) m |= 4;
    if (joins(g.tile(t.x, t.y - 1))) m |= 8;
    return m;
  }

  private sync(g: BurrowTown, now: number) {
    const tk = g.valley.seed + ':' + g.index;
    if (this.terrainKey !== tk) {
      this.terrainKey = tk;
      this.ground.clear();
      seed = g.valley.seed;
      for (const t of g.tiles) {
        const m = terrainMesh(t);
        const p = world(t.x, t.y);
        m.position.set(p.x, 0, p.z);
        this.ground.add(m);
      }
      for (const b of this.built.values()) this.scene.remove(b.group);
      for (const r of this.roads.values()) this.scene.remove(r.group);
      this.built.clear();
      this.roads.clear();
      this.walkers.forEach((w) => {
        w.tile = [W >> 1, H >> 1];
        w.progress = 1;
      });
    }
    for (const t of g.tiles) {
      const i = t.y * W + t.x;
      const p = world(t.x, t.y);
      const h = this.tileHeight(t);
      const rkey = t.road ? `${this.roadMask(g, t)}|${t.t === 'river' ? 'b' : 'r'}` : '';
      const road = this.roads.get(i);
      if ((road?.key ?? '') !== rkey) {
        if (road) this.scene.remove(road.group);
        if (rkey) {
          const group = roadMesh(this.roadMask(g, t), t.t === 'river', h);
          group.position.set(p.x, 0, p.z);
          this.scene.add(group);
          this.roads.set(i, { key: rkey, group });
        } else this.roads.delete(i);
      }
      const bkey = t.b ? `${t.b}|${t.res > 0 ? 1 : 0}|${t.linked ? 1 : 0}|${t.ruin ? 1 : 0}` : '';
      const b = this.built.get(i);
      if ((b?.key ?? '') !== bkey) {
        if (b) this.scene.remove(b.group);
        if (bkey) {
          seed = i * 31 + 7;
          const group = buildingMesh(t.b!, t, h, t.ruin);
          group.position.set(p.x, h, p.z);
          group.rotation.y = t.b === 'plaza' ? 0 : ((i * 7919) % 4) * (Math.PI / 2);
          group.userData.lit = t.res > 0 || !HOUSING.includes(t.b!);
          if (!t.linked && t.b !== 'plaza' && !t.ruin) {
            // A bobbing marker over anything the roads have not reached yet.
            const flag = part(group, G.cone, M.cloth, [0, 1.15, 0], [0.09, 0.16, 0.09], [Math.PI, 0, 0]);
            flag.userData.puff = 0;
            part(flag, G.sphere, M.clothPale, [0, -0.9, 0], [0.5, 0.3, 0.5]);
          }
          this.scene.add(group);
          this.built.set(i, { key: bkey, group, born: b ? now : 0 });
        } else this.built.delete(i);
      }
    }
  }

  setOverlay(mode: Overlay) {
    this.overlay = mode;
  }
  /** Paint one data layer over the tiles: desirability, what the roads reach, or what earns. */
  private syncOverlay(g: BurrowTown) {
    if (this.overlay === 'none') {
      this.overlayGroup.visible = false;
      return;
    }
    if (!this.plates.length) {
      const geo = new T.PlaneGeometry(TILE * 0.94, TILE * 0.94);
      for (let i = 0; i < W * H; i++) {
        const m = new T.Mesh(geo, new T.MeshBasicMaterial({ transparent: true, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        this.overlayGroup.add(m);
        this.plates.push(m);
      }
      this.scene.add(this.overlayGroup);
    }
    this.overlayGroup.visible = true;
    const c = new T.Color();
    for (const t of g.tiles) {
      const plate = this.plates[t.y * W + t.x];
      const p = world(t.x, t.y);
      plate.position.set(p.x, HEIGHT[t.t] + 0.05, p.z);
      const m = plate.material as T.MeshBasicMaterial;
      let opacity = 0.55;
      if (this.overlay === 'comfort') {
        if (t.t === 'river') opacity = 0;
        else c.setHSL(0.02 + Math.max(0, Math.min(1, t.desire / 4)) * 0.3, 0.8, 0.48);
      } else if (this.overlay === 'links') {
        if (!t.b && !t.road) opacity = 0;
        else c.set(t.linked ? 0x4fbf6a : 0xdd5b48);
      } else {
        const earn = t.yield + t.stoneYield * 2;
        if (!earn) opacity = t.b && !t.ruin ? 0.18 : 0;
        else c.set(t.stoneYield ? 0x6fa8dc : 0xf0c14b);
        if (earn) opacity = 0.35 + Math.min(0.5, earn / 10);
      }
      m.opacity = opacity;
      m.color.copy(c);
      plate.visible = opacity > 0;
    }
  }

  private animateWalker(w: Walker, g: BurrowTown, dt: number, t: number) {
    if (w.progress >= 1) {
      w.pause -= dt;
      animateChinchilla(w.chin, t, 0, true, 1);
      if (w.pause > 0) return;
      const [x, y] = w.tile;
      const options = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([nx, ny]) => {
        const o = g.tile(nx, ny);
        return o && (o.road || o.b === 'plaza');
      });
      if (!options.length) {
        w.pause = 1;
        return;
      }
      const next = options[Math.floor(Math.random() * options.length)] as [number, number];
      const here = g.tile(x, y);
      w.from.copy(world(x, y)).setY(here ? HEIGHT[here.t] : HEIGHT.grass);
      const there = g.tile(next[0], next[1])!;
      w.to.copy(world(next[0], next[1])).setY(there.t === 'river' ? HEIGHT.grass + 0.05 : HEIGHT[there.t]);
      w.tile = next;
      w.progress = 0;
      w.pause = Math.random() < 0.25 ? 0.8 + Math.random() * 1.6 : 0;
      w.pivot.rotation.y = Math.atan2(w.to.x - w.from.x, w.to.z - w.from.z) - Math.PI / 2;
      return;
    }
    w.progress = Math.min(1, w.progress + dt * w.speed);
    w.pivot.position.lerpVectors(w.from, w.to, w.progress);
    w.pivot.position.y += 0.03;
    animateChinchilla(w.chin, t, 1, true, 1);
  }

  private syncMinis(g: BurrowTown, dt: number) {
    const want = Math.min(28, Math.floor(g.stats.residents / 3));
    while (this.minis.length < want) {
      const root = new T.Group();
      const white = Math.random() < 0.45;
      const coat = mat(white ? 0xe9e2d6 : 0x5d5c64);
      part(root, G.sphere, coat, [0, 0.09, 0], [0.11, 0.09, 0.09]);
      part(root, G.sphere, coat, [0.08, 0.15, 0], [0.07, 0.07, 0.065]);
      part(root, G.sphere, coat, [0.06, 0.22, -0.04], [0.03, 0.045, 0.012]);
      part(root, G.sphere, coat, [0.06, 0.22, 0.04], [0.03, 0.045, 0.012]);
      part(root, G.sphere, M.door, [0.14, 0.16, 0.03], [0.012, 0.012, 0.012]);
      part(root, G.sphere, M.door, [0.14, 0.16, -0.03], [0.012, 0.012, 0.012]);
      const homes = g.tiles.filter((h) => h.res > 0);
      const home = homes[Math.floor(Math.random() * homes.length)] ?? g.tile(W >> 1, H >> 1)!;
      const p = world(home.x, home.y);
      root.position.set(p.x, HEIGHT[home.t], p.z);
      this.scene.add(root);
      this.minis.push({ root, from: root.position.clone(), to: root.position.clone(), tile: [home.x, home.y], progress: 1, pause: Math.random() * 2 });
    }
    while (this.minis.length > want) this.scene.remove(this.minis.pop()!.root);
    for (const m of this.minis) {
      if (m.progress >= 1) {
        m.pause -= dt;
        if (m.pause > 0) continue;
        const [x, y] = m.tile;
        const options = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([nx, ny]) => {
          const o = g.tile(nx, ny);
          return o && (o.road || o.b === 'plaza' || (o.b && HOUSING.includes(o.b)));
        });
        if (!options.length) {
          m.pause = 2;
          continue;
        }
        const next = options[Math.floor(Math.random() * options.length)] as [number, number];
        const there = g.tile(next[0], next[1])!;
        m.from.copy(m.root.position);
        m.to.copy(world(next[0], next[1])).setY(there.t === 'river' ? HEIGHT.grass + 0.05 : HEIGHT[there.t]);
        m.tile = next;
        m.progress = 0;
        m.pause = 0.5 + Math.random() * 2.5;
        m.root.rotation.y = Math.atan2(m.to.x - m.from.x, m.to.z - m.from.z) - Math.PI / 2;
        continue;
      }
      m.progress = Math.min(1, m.progress + dt * 0.7);
      m.root.position.lerpVectors(m.from, m.to, m.progress);
      m.root.position.y += Math.abs(Math.sin(m.progress * 18)) * 0.03;
    }
  }

  render(g: BurrowTown, t: number) {
    const dt = this.clock ? Math.min(0.1, t - this.clock) : 0;
    this.clock = t;
    this.sync(g, t);
    this.syncOverlay(g);
    // A dry day bleaches the grass; it fades back overnight.
    const straw = g.dry ? 1 : 0;
    M.grass.color.lerpColors(GREEN.grass, STRAW.grass, straw);
    M.grassDark.color.lerpColors(GREEN.grassDark, STRAW.grassDark, straw);
    M.terrace.color.lerpColors(GREEN.terrace, STRAW.terrace, straw);
    // Day-night: daylight 0..0.5 is day, 0.5..1 is dusk into night and dawn.
    const d = g.daylight;
    const night = d < 0.5 ? 0 : d < 0.62 ? (d - 0.5) / 0.12 : d < 0.88 ? 1 : 1 - (d - 0.88) / 0.12;
    const dusk = Math.max(0, 1 - Math.abs(d - 0.56) / 0.1) + Math.max(0, 1 - Math.abs(d - 0.94) / 0.08);
    const sky = this.sky.day.clone().lerp(this.sky.night, night).lerp(this.sky.dusk, dusk * 0.6);
    (this.scene.background as T.Color).copy(sky);
    (this.scene.fog as T.Fog).color.copy(sky);
    // The sun rises at daylight 0, peaks at 0.25 and sets at 0.5; the moon takes the second half.
    const arc = (d < 0.5 ? d / 0.5 : (d - 0.5) / 0.5) * Math.PI;
    this.sun.position.set(Math.cos(arc) * 20, 3 + Math.sin(arc) * 24, 12);
    this.sun.intensity = 2.4 * (1 - night * 0.85);
    this.sun.color.set(night > 0.5 ? 0x9fb4ff : 0xfff0d0);
    this.hemi.intensity = 1.6 - night * 1.1;
    M.window.emissiveIntensity = night * 1.6;
    M.lamp.emissiveIntensity = night * 2.2 + 0.05;
    M.river.opacity = 0.86 + Math.sin(t * 1.3) * 0.04;
    // Lamps: up to six point lights on plazas and watchtowers, nearest the camera target.
    const lampSpots: T.Vector3[] = [];
    for (const b of this.built.values()) for (const l of (b.group.userData.lamps as T.Mesh[]) ?? []) lampSpots.push(l.getWorldPosition(new T.Vector3()));
    lampSpots.sort((a, b) => a.distanceTo(this.target) - b.distanceTo(this.target));
    this.lights.forEach((l, i) => {
      const s = lampSpots[i];
      l.visible = !!s && night > 0.02;
      if (s) {
        l.position.copy(s);
        l.intensity = night * (2.2 + Math.sin(t * 7 + i) * 0.15);
      }
    });
    for (const b of this.built.values()) {
      const age = b.born ? t - b.born : 1;
      const s = age < 0.35 ? 0.3 + (age / 0.35) * 0.7 : 1;
      b.group.scale.setScalar(s * (age < 0.5 && age >= 0.35 ? 1 + Math.sin(((age - 0.35) / 0.15) * Math.PI) * 0.06 : 1));
      b.group.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        if (o.userData.puff !== undefined) o.position.y = (o.userData.base ??= o.position.y) + Math.sin(t * 1.4 + o.userData.puff) * 0.04;
        if (o.userData.spin) o.rotation.x = t * 1.5;
      });
    }
    for (const w of this.walkers) this.animateWalker(w, g, g.paused ? 0 : dt, t);
    this.syncMinis(g, g.paused ? 0 : dt);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist, this.target.y + Math.sin(this.pitch) * this.dist, this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist);
    this.camera.lookAt(this.target);
    this.sun.target.position.copy(this.target);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
