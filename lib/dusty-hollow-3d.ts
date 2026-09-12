// A voxel view of Dusty Hollow: the same engine, built out of boxes. Prototype
// alongside lib/dusty-hollow-scene.ts, which stays the default pixel-art view.
// Nothing here touches the rules; it only reads the engine every frame.
import * as T from 'three';
import { Hollow, W, H, BUILDINGS, BOARD, NEIGHBOURS, type Season } from './dusty-hollow-game';

/** Height of the top face of each terrain, in tiles. */
const TOP: Record<string, number> = { water: -0.16, sand: 0.2, path: 0.26, grass: 0.32, bridge: 0.38, cliff: 1.25 };
const GRASS: Record<Season, [number, number]> = { spring: [0x86bb66, 0x7cb15e], summer: [0x78b356, 0x6faa4e], autumn: [0xb4a558, 0xa89a4e], winter: [0xe4eaed, 0xd8e0e4] };
const TERRAIN_COLOR: Record<string, [number, number]> = { path: [0xd8c299, 0xcfb98f], sand: [0xece0b4, 0xe2d5a6], cliff: [0x6f6a63, 0x666159], bridge: [0xa8763f, 0x9c6c38], water: [0x4f9ad0, 0x4a93c9] };
const TREE_LEAF: Record<Season, number> = { spring: 0x4f9a4a, summer: 0x3f8f43, autumn: 0xd98a3c, winter: 0x7c8b80 };
const FRUIT_COLOR: Record<string, number> = { apple: 0xe04c3a, pear: 0xc9d35a, peach: 0xf2a36c, cherry: 0xb8203a, orange: 0xf09a2c, golden: 0xffd94a };
const FLOWER_COLOR: Record<string, number> = { red: 0xe2413c, yellow: 0xf2d54a, white: 0xfbf8f0, orange: 0xf28c2c, pink: 0xf4a3c4, purple: 0x9a6cd6, blue: 0x5b8de6 };
const BUG_COLOR: Record<string, number> = { butterfly: 0xf0c04a, swallowtail: 0x3f3a4a, bee: 0xf2b830, ladybug: 0xe0392f, grasshopper: 0x6fbf4a, cricket: 0x5a4a3a, firefly: 0xf6f08a, dragonfly: 0x5fc1d9, cicada: 0x8a6f4a, moth: 0xcbbfa5, stag: 0x2f2a2a, snail: 0xb89c6a, wintermoth: 0xe8e4d8, snowflea: 0x3a3a44, hercules: 0x4a3a26 };
const BODY: Record<string, number> = { dora: 0xf2ede4, enzo: 0x8e8f98, flamingo: 0xf39ab5, fox: 0xd9873c, viscacha: 0xb7a58c, condor: 0x4a4750, llama: 0xe8dcc2, cat: 0x8a7f73 };
const HOUSE: Record<string, [number, number]> = { home: [0xc98a5a, 0x8f5a34], friend: [0xb98d64, 0x7c5a3c], shop: [0xd76f5c, 0x8b3d31], museum: [0x8d9aa8, 0x4f5b68] };
/** Species drawn with a beak rather than ears. */
const BEAKED = ['flamingo', 'condor'];
const POINTY = ['cat', 'llama'];
const FLYING = ['butterfly', 'swallowtail', 'bee', 'firefly', 'dragonfly', 'moth', 'wintermoth'];

const box = new T.BoxGeometry(1, 1, 1);
/** A unit box whose top face sits at y = 0, so a mesh's y is the height of its top. */
const capped = new T.BoxGeometry(1, 1, 1).translate(0, -0.5, 0);
/** A unit box standing on y = 0, so a mesh's y is the ground it stands on. */
const standing = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
// A square-based pyramid standing on y = 0. The 45 degree turn is baked into the
// geometry: rotating the mesh instead would shear the base once x and z scale apart.
const roofGeo = new T.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);

const mat = (color: number, extra: Partial<T.MeshLambertMaterialParameters> = {}) => new T.MeshLambertMaterial({ color, ...extra });

/** A blocky critter: a body, a head and whatever the species wears on it. */
type Critter = { root: T.Group; body: T.Mesh; head: T.Group; label: T.Sprite | null; species: string };

export class HollowScene3D {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(46, 1.6, 0.5, 120);
  private sun = new T.DirectionalLight(0xfff0d0, 1.5);
  private hemi = new T.HemisphereLight(0xdcefff, 0x6b6350, 1.1);
  private ground: T.InstancedMesh;
  private water: T.InstancedMesh;
  private waterTiles: { x: number; y: number }[] = [];
  private trees = new T.Group();
  private rocks = new T.Group();
  private scatter = new T.Group();
  private bugs = new T.Group();
  private critters = new Map<string, Critter>();
  private windows: T.Mesh[] = [];
  private bobber: T.Mesh;
  private look = new T.Vector3(W / 2, 0, H / 2);
  private season: Season | null = null;
  private keys = { trees: '', scatter: '' };
  private time = 0;
  private sky = { day: new T.Color(0x9fd0ea), dusk: new T.Color(0xe8a271), night: new T.Color(0x1c2740) };

  constructor(public canvas: HTMLCanvasElement) {
    // preserveDrawingBuffer keeps photo mode working: toBlob reads the last frame.
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.scene.background = this.sky.day.clone();
    this.scene.fog = new T.Fog(this.sky.day.clone(), 34, 66);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const cam = this.sun.shadow.camera;
    cam.left = -16; cam.right = 16; cam.top = 14; cam.bottom = -14; cam.far = 60;
    this.sun.shadow.bias = -0.0012;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.trees, this.rocks, this.scatter, this.bugs);
    this.ground = new T.InstancedMesh(capped, mat(0xffffff), W * H);
    this.ground.receiveShadow = true;
    this.water = new T.InstancedMesh(capped, new T.MeshLambertMaterial({ color: 0x4f9ad0, transparent: true, opacity: 0.92 }), W * H);
    this.scene.add(this.ground, this.water);
    this.bobber = new T.Mesh(box, mat(0xe0392f));
    this.bobber.visible = false;
    this.scene.add(this.bobber);
  }

  // ---- terrain ------------------------------------------------------------
  /** Lay the fixed map out as one instanced slab of boxes, recoloured when the season turns. */
  private buildGround(g: Hollow) {
    const m = new T.Matrix4(), color = new T.Color();
    let solid = 0, wet = 0;
    this.waterTiles = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = g.tileAt(x, y), alt = (x + y) & 1;
      const top = TOP[t] ?? TOP.grass;
      if (t === 'water') {
        this.waterTiles.push({ x, y });
        m.compose(new T.Vector3(x + 0.5, top, y + 0.5), new T.Quaternion(), new T.Vector3(1, 0.5, 1));
        this.water.setMatrixAt(wet, m);
        this.water.setColorAt(wet, color.setHex(TERRAIN_COLOR.water[alt]));
        wet++;
        // A riverbed under the water so nothing shows through from below.
        m.compose(new T.Vector3(x + 0.5, top - 0.22, y + 0.5), new T.Quaternion(), new T.Vector3(1, 1, 1));
        this.ground.setMatrixAt(solid, m);
        this.ground.setColorAt(solid, color.setHex(0x8d7f5e));
        solid++;
        continue;
      }
      const hex = t === 'grass' ? GRASS[g.season][alt] : (TERRAIN_COLOR[t] ?? GRASS[g.season])[alt];
      m.compose(new T.Vector3(x + 0.5, top, y + 0.5), new T.Quaternion(), new T.Vector3(1, t === 'cliff' ? 1.6 : 0.9, 1));
      this.ground.setMatrixAt(solid, m);
      this.ground.setColorAt(solid, color.setHex(hex));
      solid++;
    }
    this.ground.count = solid;
    this.water.count = wet;
    this.ground.instanceMatrix.needsUpdate = true;
    this.water.instanceMatrix.needsUpdate = true;
    if (this.ground.instanceColor) this.ground.instanceColor.needsUpdate = true;
    if (this.water.instanceColor) this.water.instanceColor.needsUpdate = true;
  }
  /** Let the surface breathe; the sea rolls harder than the river. */
  private rippleWater() {
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(1, 0.5, 1);
    this.waterTiles.forEach((t, i) => {
      const swell = t.y >= H - 3 ? 0.05 : 0.022;
      p.set(t.x + 0.5, TOP.water + Math.sin(this.time * 1.8 + t.x * 0.8 + t.y * 0.5) * swell, t.y + 0.5);
      m.compose(p, q, s);
      this.water.setMatrixAt(i, m);
    });
    this.water.instanceMatrix.needsUpdate = true;
  }

  // ---- static furniture ---------------------------------------------------
  private buildVillage(g: Hollow) {
    for (const b of BUILDINGS) {
      const owner = NEIGHBOURS.find((v) => v.home === b.id);
      const group = new T.Group();
      const [wall, roof] = HOUSE[b.id] ?? [0xc9a37a, 0x7f6446];
      if (owner?.arrives && !g.arrived.includes(owner.id)) {
        // An empty plot: four posts and a board.
        for (const [dx, dz] of [[0.3, 0.3], [b.w - 0.3, 0.3], [0.3, b.h - 0.3], [b.w - 0.3, b.h - 0.3]]) {
          const post = new T.Mesh(standing, mat(0x8f5a34));
          post.position.set(b.x + dx, TOP.grass, b.y + dz);
          post.scale.set(0.14, 0.7, 0.14);
          group.add(post);
        }
        const sign = new T.Mesh(standing, mat(0xf6e6c8));
        sign.position.set(b.x + b.w / 2, TOP.grass + 0.7, b.y + b.h / 2);
        sign.scale.set(1.1, 0.6, 0.1);
        group.add(sign);
        group.add(this.sprite('FOR SALE', '#8f5a34', b.x + b.w / 2, TOP.grass + 1.5, b.y + b.h / 2, 0.3));
        this.scene.add(group);
        continue;
      }
      const body = new T.Mesh(standing, mat(wall));
      body.position.set(b.x + b.w / 2, TOP.grass, b.y + b.h / 2);
      body.scale.set(b.w - 0.1, 1.25, b.h - 0.1);
      body.castShadow = true; body.receiveShadow = true;
      group.add(body);
      // A four-sided pyramid reads as a roof and keeps the blocky silhouette.
      const cap = new T.Mesh(roofGeo, mat(b.id === 'home' && g.homeLevel === 0 ? 0xe8c56d : roof));
      cap.position.set(b.x + b.w / 2, TOP.grass + 1.25, b.y + b.h / 2);
      cap.scale.set(b.w + 0.35, 0.8, b.h + 0.35);
      cap.castShadow = true;
      group.add(cap);
      const door = new T.Mesh(standing, mat(0x5a3a22));
      door.position.set(b.door[0] + 0.5, TOP.grass, b.y + b.h - 0.02);
      door.scale.set(0.6, 0.85, 0.12);
      group.add(door);
      for (const side of [-1, 1]) {
        const win = new T.Mesh(box, new T.MeshLambertMaterial({ color: 0xf2e6d0, emissive: 0xffd27a, emissiveIntensity: 0 }));
        win.position.set(b.x + b.w / 2 + side * (b.w / 2 - 0.45), TOP.grass + 0.8, b.y + b.h - 0.02);
        win.scale.set(0.34, 0.34, 0.1);
        group.add(win);
        this.windows.push(win);
      }
      group.add(this.sprite(b.id === 'home' ? g.houseName : b.name, '#2b2118', b.x + b.w / 2, TOP.grass + 2.3, b.y + b.h / 2, 0.34, '#fffaf0'));
      this.scene.add(group);
    }
    // The notice board.
    const post = new T.Mesh(standing, mat(0x7a4d2b));
    post.position.set(BOARD.x + 0.5, TOP.grass, BOARD.y + 0.5);
    post.scale.set(0.12, 0.5, 0.12);
    const face = new T.Mesh(standing, mat(0xb98d64));
    face.position.set(BOARD.x + 0.5, TOP.grass + 0.5, BOARD.y + 0.5);
    face.scale.set(0.8, 0.55, 0.12);
    face.castShadow = true;
    this.scene.add(post, face);
  }
  private rebuildTrees(g: Hollow) {
    const key = g.trees.map((t) => `${t.x},${t.y},${t.count},${t.grown},${t.golden ? 1 : 0}`).join('|') + g.season;
    if (key === this.keys.trees) return;
    this.keys.trees = key;
    this.clear(this.trees);
    for (const t of g.trees) {
      const sapling = t.grown > 0, leaf = t.golden && !sapling ? 0xd9b73c : TREE_LEAF[g.season];
      const trunk = new T.Mesh(standing, mat(0x7a4d2b));
      trunk.position.set(t.x + 0.5, TOP.grass, t.y + 0.5);
      trunk.scale.set(0.26, sapling ? 0.5 : 0.95, 0.26);
      trunk.castShadow = true;
      this.trees.add(trunk);
      const tiers: [number, number, number][] = sapling ? [[0.6, 0.45, 0.5]] : [[1.1, 0.55, 0.95], [0.8, 0.5, 1.45]];
      for (const [wide, tall, at] of tiers) {
        const crown = new T.Mesh(standing, mat(leaf));
        crown.position.set(t.x + 0.5, TOP.grass + at, t.y + 0.5);
        crown.scale.set(wide, tall, wide);
        crown.castShadow = true; crown.receiveShadow = true;
        this.trees.add(crown);
      }
      if (!sapling) for (let i = 0; i < t.count; i++) {
        const spot = [[-0.42, 0.9, 0.2], [0.4, 1.15, -0.25], [0.1, 0.85, 0.44]][i];
        const fruit = new T.Mesh(box, mat(t.golden ? FRUIT_COLOR.golden : FRUIT_COLOR[t.fruit] ?? 0xe04c3a));
        fruit.position.set(t.x + 0.5 + spot[0], TOP.grass + spot[1], t.y + 0.5 + spot[2]);
        fruit.scale.setScalar(0.2);
        this.trees.add(fruit);
      }
    }
  }
  /** Rocks never move, so they are built once with the village. */
  private buildRocks(g: Hollow) {
    for (const r of g.rocks) {
      for (const [dx, dz, w, hgt] of [[0, 0, 0.8, 0.5], [0.22, 0.18, 0.42, 0.66], [-0.2, -0.16, 0.34, 0.4]]) {
        const m = new T.Mesh(standing, mat(0x9a948b));
        m.position.set(r.x + 0.5 + dx, TOP.grass, r.y + 0.5 + dz);
        m.scale.set(w, hgt, w);
        m.castShadow = true; m.receiveShadow = true;
        this.rocks.add(m);
      }
    }
  }
  /** Everything that comes and goes with the day: flowers, fossils, shells, snow. */
  private rebuildScatter(g: Hollow) {
    const key = [g.flowers.map((f) => `${f.x},${f.y},${f.color},${f.watered ? 1 : 0}`).join(), g.fossils.map((f) => `${f.x},${f.y}`).join(), g.shells.map((s) => `${s.x},${s.y},${s.id}`).join(), g.snowballs.map((s) => `${s.x},${s.y}`).join(), g.snowmen.map((s) => `${s.x},${s.y}`).join()].join('|');
    if (key === this.keys.scatter) return;
    this.keys.scatter = key;
    this.clear(this.scatter);
    for (const f of g.flowers) {
      const stem = new T.Mesh(standing, mat(0x3f8140));
      stem.position.set(f.x + 0.5, TOP.grass, f.y + 0.5);
      stem.scale.set(0.08, 0.3, 0.08);
      const head = new T.Mesh(standing, mat(FLOWER_COLOR[f.color] ?? 0xffffff));
      head.position.set(f.x + 0.5, TOP.grass + 0.3, f.y + 0.5);
      head.scale.set(0.32, 0.18, 0.32);
      head.castShadow = true;
      this.scatter.add(stem, head);
      if (f.watered) {
        const wet = new T.Mesh(capped, new T.MeshLambertMaterial({ color: 0x5da2cf, transparent: true, opacity: 0.5 }));
        wet.position.set(f.x + 0.5, TOP.grass + 0.02, f.y + 0.5);
        wet.scale.set(0.7, 0.04, 0.7);
        this.scatter.add(wet);
      }
    }
    for (const f of g.fossils) {
      const crack = new T.Mesh(capped, mat(0x5a4a3a));
      crack.position.set(f.x + 0.5, TOP.grass + 0.03, f.y + 0.5);
      crack.scale.set(0.5, 0.06, 0.5);
      this.scatter.add(crack);
    }
    for (const s of g.shells) {
      const shell = new T.Mesh(standing, mat(s.id === 'conch' ? 0xf2b8a0 : s.id === 'sanddollar' ? 0xefe3c2 : 0xfbf5e6));
      shell.position.set(s.x + 0.5, TOP.sand, s.y + 0.5);
      shell.scale.set(0.3, s.id === 'conch' ? 0.26 : 0.12, 0.3);
      shell.castShadow = true;
      this.scatter.add(shell);
    }
    for (const s of g.snowballs) {
      const ball = new T.Mesh(standing, mat(0xfbfdff));
      ball.position.set(s.x + 0.5, TOP.grass, s.y + 0.5);
      ball.scale.setScalar(0.48);
      ball.castShadow = true;
      this.scatter.add(ball);
    }
    for (const s of g.snowmen) {
      for (const [at, size] of [[0, 0.62], [0.62, 0.44], [1.06, 0.3]]) {
        const part = new T.Mesh(standing, mat(0xfbfdff));
        part.position.set(s.x + 0.5, TOP.grass + at, s.y + 0.5);
        part.scale.set(size, size, size);
        part.castShadow = true;
        this.scatter.add(part);
      }
    }
  }

  // ---- critters -----------------------------------------------------------
  private makeCritter(species: string, name: string, you: boolean): Critter {
    const root = new T.Group(), head = new T.Group();
    const skin = BODY[species] ?? 0xb7a58c;
    const tall = species === 'flamingo' || species === 'condor' || species === 'llama';
    const body = new T.Mesh(standing, mat(skin));
    body.scale.set(0.5, tall ? 0.78 : 0.56, 0.42);
    body.castShadow = true;
    root.add(body);
    head.position.y = tall ? 0.78 : 0.56;
    root.add(head);
    const skull = new T.Mesh(standing, mat(skin));
    skull.scale.set(0.46, 0.42, 0.4);
    skull.castShadow = true;
    head.add(skull);
    if (BEAKED.includes(species)) {
      const beak = new T.Mesh(standing, mat(species === 'flamingo' ? 0x3a2a2a : 0xe8b04a));
      beak.position.set(0, 0.14, 0.24);
      beak.scale.set(0.14, 0.12, 0.22);
      head.add(beak);
    } else {
      for (const side of [-1, 1]) {
        const ear = new T.Mesh(standing, mat(skin));
        ear.position.set(side * 0.19, 0.38, 0);
        if (POINTY.includes(species)) ear.scale.set(0.14, 0.26, 0.1);
        else ear.scale.set(0.2, 0.22, 0.09);
        ear.castShadow = true;
        head.add(ear);
        const inner = new T.Mesh(standing, mat(0xf2b8c0));
        inner.position.set(side * 0.19, 0.4, 0.045);
        inner.scale.set(POINTY.includes(species) ? 0.07 : 0.11, 0.15, 0.04);
        head.add(inner);
      }
    }
    for (const side of [-1, 1]) {
      const eye = new T.Mesh(box, mat(0x2a2420));
      eye.position.set(side * 0.12, 0.26, 0.2);
      eye.scale.set(0.08, 0.09, 0.04);
      head.add(eye);
    }
    const label = this.sprite(name, you ? '#8a5a00' : '#34302a', 0, 0, 0, 0.3, you ? '#ffe08a' : '#fffaf0');
    label.position.set(0, (tall ? 0.78 : 0.56) + 0.78, 0);
    root.add(label);
    root.scale.setScalar(1.2);
    this.scene.add(root);
    return { root, body, head, label, species };
  }
  /** Keep one critter per resident plus the hero, rebuilding only when a name or species changes. */
  private syncCritters(g: Hollow) {
    const want = new Map<string, { x: number; y: number; facing: number; species: string; name: string; moving: boolean; you: boolean }>();
    want.set('@hero', { x: g.x, y: g.y, facing: g.facing, species: g.hero, name: `${g.heroName} (you)`, moving: g.moving, you: true });
    for (const v of g.residents) if (g.out(v)) want.set(v.id, { x: v.x, y: v.y, facing: v.facing, species: v.species, name: v.name + (g.isBirthday(v.id) ? ' 🎂' : ''), moving: false, you: false });
    for (const [id, c] of this.critters) if (!want.has(id)) { this.scene.remove(c.root); this.disposeTree(c.root); this.critters.delete(id); }
    for (const [id, w] of want) {
      let c = this.critters.get(id);
      if (!c || c.species !== w.species || c.root.userData.name !== w.name) {
        if (c) { this.scene.remove(c.root); this.disposeTree(c.root); }
        c = this.makeCritter(w.species, w.name, w.you);
        c.root.userData.name = w.name;
        this.critters.set(id, c);
      }
      const bob = w.moving ? Math.abs(Math.sin(this.time * 11)) * 0.09 : Math.sin(this.time * 1.8) * 0.015;
      c.root.position.set(w.x, TOP.grass + bob, w.y);
      // Facing runs up, right, down, left; three.js turns the other way round Y.
      c.root.rotation.y = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][w.facing];
      c.head.rotation.z = Math.sin(this.time * 1.2) * 0.05;
    }
  }
  private syncBugs(g: Hollow) {
    this.clear(this.bugs);
    for (const b of g.bugs) {
      const m = new T.Mesh(standing, mat(BUG_COLOR[b.id] ?? 0x333333));
      const flies = FLYING.includes(b.id) || b.fleeing;
      m.position.set(b.x, TOP.grass + (flies ? 0.85 : 0.12) + Math.sin(this.time * 6 + b.x) * 0.06, b.y);
      m.scale.set(0.22, 0.16, 0.3);
      m.castShadow = true;
      this.bugs.add(m);
      if (flies) for (const side of [-1, 1]) {
        const wing = new T.Mesh(standing, new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
        wing.position.copy(m.position);
        wing.position.x += side * 0.16;
        wing.scale.set(0.2, 0.03, 0.24 + Math.abs(Math.sin(this.time * 18)) * 0.12);
        this.bugs.add(wing);
      }
    }
  }

  // ---- frame --------------------------------------------------------------
  draw(g: Hollow, dt: number) {
    this.time += dt;
    this.resize();
    if (this.season === null) { this.buildGround(g); this.buildVillage(g); this.buildRocks(g); this.season = g.season; }
    else if (this.season !== g.season) { this.buildGround(g); this.season = g.season; }
    this.rippleWater();
    this.rebuildTrees(g);
    this.rebuildScatter(g);
    this.syncCritters(g);
    this.syncBugs(g);
    // Fishing: a bobber where the line went in, yellow on the bite.
    if (g.fishing) {
      this.bobber.visible = g.fishing.phase !== 'reel';
      this.bobber.position.set(g.fishing.x + 0.5, TOP.water + 0.18 + Math.sin(this.time * 5) * 0.04, g.fishing.y + 0.5);
      this.bobber.scale.setScalar(g.fishing.phase === 'bite' ? 0.3 : 0.22);
      (this.bobber.material as T.MeshLambertMaterial).color.setHex(g.fishing.phase === 'bite' ? 0xffdd55 : 0xe0392f);
    } else this.bobber.visible = false;
    this.light(g);
    // A fixed angled camera trailing the hero, so up on the pad is still up on screen.
    this.look.lerp(new T.Vector3(g.x, TOP.grass, g.y), Math.min(1, dt * 5));
    this.camera.position.set(this.look.x, this.look.y + 13.5, this.look.z + 11.5);
    this.camera.lookAt(this.look.x, this.look.y + 0.8, this.look.z);
    this.sun.position.set(this.look.x + 9, this.look.y + 18, this.look.z + 7);
    this.sun.target.position.copy(this.look);
    this.sun.target.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
  }
  /** Sky, sun and lit windows follow the clock the same way the 2D view's tint does. */
  private light(g: Hollow) {
    const h = g.hour;
    const dusk = h >= 17 && h < 20, night = h >= 20 || h < 6, dawn = h >= 6 && h < 8;
    const target = night ? this.sky.night : dusk || dawn ? this.sky.dusk : this.sky.day;
    (this.scene.background as T.Color).lerp(target, 0.02);
    (this.scene.fog as T.Fog).color.copy(this.scene.background as T.Color);
    this.sun.intensity = night ? 0.12 : dusk || dawn ? 0.75 : 1.5;
    this.hemi.intensity = night ? 0.32 : dusk || dawn ? 0.8 : 1.1;
    this.sun.color.setHex(dusk ? 0xffb27a : night ? 0x8fa6d8 : 0xfff0d0);
    if (g.weather !== 'clear') { this.sun.intensity *= 0.55; this.hemi.intensity *= 0.85; }
    const lit = g.isNight ? 1.1 : 0;
    for (const w of this.windows) (w.material as T.MeshLambertMaterial).emissiveIntensity = lit;
  }
  resize() {
    const w = this.canvas.clientWidth || 960, h = this.canvas.clientHeight || 600;
    if (this.canvas.width === Math.floor(w * this.renderer.getPixelRatio()) && this.camera.aspect === w / h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- helpers ------------------------------------------------------------
  /** A text label drawn to a canvas and hung in the world, always facing the camera. */
  private sprite(text: string, color: string, x: number, y: number, z: number, size: number, plate?: string) {
    const c = document.createElement('canvas');
    const probe = c.getContext('2d')!;
    probe.font = 'bold 40px Arial';
    c.width = Math.ceil(probe.measureText(text).width) + 28;
    c.height = 60;
    const ctx = c.getContext('2d')!;
    if (plate) {
      ctx.fillStyle = plate;
      ctx.beginPath();
      ctx.roundRect(0, 4, c.width, 52, 14);
      ctx.fill();
    }
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, c.width / 2, 31);
    const tex = new T.CanvasTexture(c);
    tex.minFilter = T.LinearFilter;
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    s.scale.set((c.width / 60) * size, size, 1);
    s.position.set(x, y, z);
    s.renderOrder = 10;
    return s;
  }
  private clear(group: T.Group) {
    for (const child of group.children.slice()) this.disposeTree(child);
    group.clear();
  }
  private disposeTree(root: T.Object3D) {
    root.traverse((o) => {
      const m = o as T.Mesh & T.Sprite;
      if (m.material) for (const mm of Array.isArray(m.material) ? m.material : [m.material]) { (mm as T.SpriteMaterial).map?.dispose(); mm.dispose(); }
    });
  }
  dispose() {
    this.clear(this.trees); this.clear(this.rocks); this.clear(this.scatter); this.clear(this.bugs);
    for (const c of this.critters.values()) this.disposeTree(c.root);
    this.critters.clear();
    this.disposeTree(this.scene);
    this.ground.dispose(); this.water.dispose();
    this.renderer.dispose();
  }
}
