// Cloudsteel: drawing only. Three.js on the WebGPU renderer (it falls back to WebGL 2 by itself): the three areas of
// the climb built from the story's data (lib/cloudsteel-story.ts), with Codex's painted figures stood up in them as
// cut-out cards. Each card turns to face the camera and picks its painting from what the figure is doing and which
// way it faces from the camera: front, back or side (the side painting mirrored for the other side) while exploring,
// and side-on paintings in a duel, where the camera swings round to watch from the side. Every action has its own
// painting: walk cycles, idles, talking, picking up, the lantern, guard, wind-ups, cuts, lunges, dodges, deflects,
// hits, staggers, finishers, falls and wins. Rules in lib/cloudsteel-game.ts and lib/cloudsteel-world.ts.
import * as T from 'three/webgpu';
import { pass, screenUV, smoothstep, float, vec2, reflector, mx_noise_float, positionWorld } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { CUTS, DODGE, FINISHER, TAG, type Fight, type FightEvent, type Foe, type Look } from './cloudsteel-game';
import { duelToWorld, inShape, LANTERN, PICKUP, type AreaId, type Duel, type Shape, type World, type WorldEvent, type Who } from './cloudsteel-world';
import { AREAS, DUELS, ITEMS, STONES } from './cloudsteel-story';
import { SPRITES, SPRITE_PPM, type SpriteSheet } from './cloudsteel-sprites';

const PI = Math.PI, art = (n: string) => `/art/cloudsteel/${n}.webp`;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const wrap = (a: number) => { while (a > PI) a -= PI * 2; while (a < -PI) a += PI * 2; return a; };
const hdr = (r: number, g: number, b: number) => new T.Color().setRGB(r, g, b);
const std = (color: number, o: T.MeshStandardMaterialParameters = {}) => new T.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
const glowM = (c: T.ColorRepresentation) => new T.MeshBasicMaterial({ color: c, fog: false });
const box = (w: number, h: number, d: number) => new T.BoxGeometry(w, h, d), cyl = (a: number, b: number, h: number, n = 20) => new T.CylinderGeometry(a, b, h, n);
function mesh(geo: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0, parent?: T.Object3D) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent?.add(m); return m; }
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!, w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
const texCache = new Map<string, T.Texture>(), texWait = new Map<T.Texture, (() => void)[]>();
function loadTex(n: string, repeat = 0) {
  const k = `${n}:${repeat}`; let t = texCache.get(k); if (t) return t;
  const tex: T.Texture = new T.TextureLoader().load(art(n), () => { for (const f of texWait.get(tex) ?? []) f(); texWait.delete(tex); }); t = tex; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); }
  texCache.set(k, t); return t;
}
/** a sub-image of a painted grid (2x2 sheets of props, foliage, carvings) */
function cellTex(n: string, cell: number, cols = 2, rows = 2) {
  // a clone is flagged for upload at once, before the image is there: share the image only once it has loaded
  const base = loadTex(n), t = new T.Texture(); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  t.repeat.set(1 / cols, 1 / rows); t.offset.set((cell % cols) / cols, 1 - (Math.floor(cell / cols) + 1) / rows);
  const fin = () => { t.source = base.source; t.needsUpdate = true; };
  if (base.image && (base.image as HTMLImageElement).complete) fin(); else { const l = texWait.get(base) ?? []; l.push(fin); texWait.set(base, l); }
  return t;
}

// ---------------------------------------------------------------- painted figures
/** a painted figure: a card on the ground that faces the camera and shows one cell of its character's atlas */
class Card {
  readonly o = new T.Group(); readonly sheet: SpriteSheet; private geo: T.PlaneGeometry; private uv: T.BufferAttribute; readonly mat: T.MeshStandardMaterial;
  private plane: T.Mesh; private blob: T.Mesh; frame = ''; mirror = false; private shown = '';
  y = 0; spin = 0; alpha = 1; bob = 0;
  constructor(readonly who: string, tex: T.Texture, blobMat: T.Material, scale = 1) {
    const s = this.sheet = SPRITES[who];
    const w = (s.cw / SPRITE_PPM) * scale, h = (s.ch / SPRITE_PPM) * scale;
    this.geo = new T.PlaneGeometry(w, h); this.uv = this.geo.attributes.uv as T.BufferAttribute;
    // the anchor (under the head, on the ground) at the group's origin
    this.geo.translate(w / 2 - (s.ax / SPRITE_PPM) * scale, (s.ay / SPRITE_PPM) * scale - h / 2, 0);
    this.mat = new T.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.06, side: T.DoubleSide, roughness: 1, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3 });
    this.mat.color.setScalar(0.72);
    this.plane = new T.Mesh(this.geo, this.mat); this.plane.renderOrder = 2; this.o.add(this.plane);
    this.blob = new T.Mesh(new T.CircleGeometry(0.5 * scale * (who === 'ukhu' ? 1.6 : 1), 24), blobMat); this.blob.rotation.x = -PI / 2; this.blob.position.y = 0.012; this.o.add(this.blob);
  }
  set(frame: string, mirror: boolean) { this.frame = frame; this.mirror = mirror; }
  /** puts the card at (x, z), turned to the camera */
  update(x: number, z: number, camYaw: number) {
    this.o.position.set(x, 0, z);
    this.plane.position.y = this.y + this.bob; this.plane.rotation.set(0, camYaw + PI, this.spin);
    (this.blob.material as T.MeshBasicMaterial).opacity = 0.5;
    this.blob.scale.setScalar(Math.max(0.3, 1 - this.y * 0.4));
    this.mat.opacity = this.alpha;
    const key = `${this.frame}|${this.mirror}`; if (key === this.shown) return; this.shown = key;
    const s = this.sheet; let i = s.frames.indexOf(this.frame); if (i < 0) i = 0;
    const u0 = (i % s.cols) / s.cols, u1 = u0 + 1 / s.cols, v1 = 1 - Math.floor(i / s.cols) / s.rows, v0 = v1 - 1 / s.rows;
    const [a, b] = this.mirror ? [u1, u0] : [u0, u1];
    // PlaneGeometry's uv order: top-left, top-right, bottom-left, bottom-right
    this.uv.setXY(0, a, v1); this.uv.setXY(1, b, v1); this.uv.setXY(2, a, v0); this.uv.setXY(3, b, v0); this.uv.needsUpdate = true;
  }
  /** the side the card mirrors to face (x, z) on screen, given the camera's right vector */
  static mirrorFor(face: number, camYaw: number) { return Math.sin(face) * -Math.cos(camYaw) + Math.cos(face) * Math.sin(camYaw) < 0; }
}
/** front, back or side painting for a figure facing `face` seen by a camera looking along `camYaw` */
function view(face: number, camYaw: number): 'front' | 'back' | 'side' {
  const rel = Math.abs(wrap(face - camYaw)); return rel < PI / 4 ? 'back' : rel > (3 * PI) / 4 ? 'front' : 'side';
}

type Fx = { o: T.Object3D; mat: T.Material; life: number; max: number; grow: number; s0: number };
type AreaBuild = { group: T.Group; planks: Map<string, T.Mesh>; gates: Map<string, T.Object3D>; stones: Map<string, T.Mesh>; posts: T.Object3D[]; lamps: T.PointLight[]; sunLamp?: T.Mesh; sunLight?: T.PointLight };
/** what to draw: the terrace duel from the title menu, or the story (with its duel, when one is on) */
export type View = { kind: 'arena'; fight: Fight } | { kind: 'story'; world: World; fight: Fight | null };
const ARENA_DUEL: Duel = { ...DUELS[0], id: 'arena' };

export class CloudsteelScene {
  private renderer: T.WebGPURenderer; private scene = new T.Scene(); private cam = new T.PerspectiveCamera(42, 16 / 9, 0.1, 700);
  private pipe: T.RenderPipeline | null = null; private fxOn: boolean;
  private areas = new Map<AreaId, AreaBuild>(); private area: AreaId | null = null; private pano!: T.MeshBasicMaterial;
  private cards = new Map<string, Card>(); private blobMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false });
  private pickups = new Map<string, T.Object3D>(); private staffL!: T.PointLight; private lanternGlow!: T.Sprite; private lanternRing!: T.Mesh;
  private fx: Fx[] = []; private trails: T.Mesh[] = []; private trailBox = new T.Group(); private tagRing!: T.Mesh; private jadeRing!: T.Mesh; private glint!: T.Sprite; private mark!: T.Mesh; private finish!: T.Mesh;
  private sparks!: T.InstancedMesh; private sP: T.Vector3[] = []; private sV: T.Vector3[] = []; private sLife = new Float32Array(140); private sNext = 0; private dum = new T.Object3D();
  private rainPos!: Float32Array; private rainG!: T.BufferGeometry; private rain!: T.LineSegments; private mists: T.Sprite[] = [];
  private softTex!: T.Texture; private inkTex!: T.Texture; private ghostMat!: T.MeshBasicMaterial; private plankMat!: T.MeshStandardMaterial;
  private now = 0; private shake = 0; private yaw = PI; private camPos = new T.Vector3(0, 4, 18); private look = new T.Vector3(0, 1.2, 0); private camInit = false;
  private duel: Duel = ARENA_DUEL; private walked = new Map<string, number>(); private lastPos = new Map<string, { x: number; z: number }>(); private parryT = new Map<number, number>();
  private talkT = 0; private lastLine: unknown = null; private coldT = 0; private orbit = 0;
  /** the player turning the camera while exploring: radians a second */
  turn = 0;
  /** 'webgpu' or 'webgl2', for the settings screen */
  backend: 'webgpu' | 'webgl2' = 'webgl2';

  /** the yaw the camera looks along, so the page can turn stick input into world directions */
  get camYaw() { return this.yaw; }
  /** a drag across the screen turns the exploring camera */
  turnBy(a: number) { this.yaw += a; }

  static async create(canvas: HTMLCanvasElement, fx: boolean) {
    const renderer = new T.WebGPURenderer({ canvas, antialias: true });
    await renderer.init();
    return new CloudsteelScene(renderer, fx);
  }
  private constructor(renderer: T.WebGPURenderer, fx: boolean) {
    this.renderer = renderer; this.fxOn = fx;
    this.backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fx ? 2 : 1.25));
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    this.scene.fog = new T.FogExp2(0x12283a, 0.014);
    this.buildSky(); this.buildEffects(); this.buildFigures();
    if (fx) {
      const scenePass = pass(this.scene, this.cam, { samples: 4 }), col = scenePass.getTextureNode();
      const vig = float(1).sub(smoothstep(0.35, 0.95, screenUV.sub(0.5).length()).mul(0.55));
      // bloom only on what is brighter than white: lanterns, sparks and strokes, never the painted faces
      this.pipe = new T.RenderPipeline(renderer); this.pipe.outputNode = col.add(bloom(col, 0.38, 0.5, 1)).mul(vig);
    }
    this.setArea('terrace');
    this.resize();
  }
  resize() {
    const c = this.renderer.domElement, w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.cam.fov = w / h < 1 ? 60 : 42; this.cam.updateProjectionMatrix();
  }
  dispose() { this.renderer.dispose(); }

  // ---------------------------------------------------------------- sky, mist, rain
  private buildSky() {
    const sc = this.scene, add = <O extends T.Object3D>(o: O) => { sc.add(o); return o; };
    const sky = canvasTex(1024, 512, (g, w, h) => {
      const l = g.createLinearGradient(0, 0, 0, h); l.addColorStop(0, '#040714'); l.addColorStop(0.3, '#0c1632'); l.addColorStop(0.47, '#12283a'); l.addColorStop(0.53, '#12283a'); l.addColorStop(1, '#070d12'); g.fillStyle = l; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 420; i++) { const y = Math.pow(Math.random(), 1.6) * h * 0.42; g.fillStyle = `rgba(220,232,255,${(0.25 + Math.random() * 0.6) * (1 - y / (h * 0.45))})`; g.fillRect(Math.random() * w, y, Math.random() < 0.12 ? 2 : 1, Math.random() < 0.12 ? 2 : 1); }
    });
    sky.mapping = T.EquirectangularReflectionMapping; sc.environment = sky; sc.environmentIntensity = 0.5;
    add(mesh(new T.SphereGeometry(300, 32, 16), new T.MeshBasicMaterial({ map: sky, side: T.BackSide, fog: false, depthWrite: false })));
    this.pano = new T.MeshBasicMaterial({ color: 0x7888a0, side: T.BackSide, fog: false, depthWrite: false });
    const ring = add(mesh(new T.CylinderGeometry(160, 160, 120, 48, 1, true), this.pano, 0, -14, -20)); ring.renderOrder = -1;
    this.softTex = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
    this.inkTex = canvasTex(128, 128, (g, w) => { g.fillStyle = '#fff'; for (let i = 0; i < 26; i++) { const a = Math.random() * PI * 2, d = Math.pow(Math.random(), 0.7) * 46, r = 4 + Math.random() * (i < 6 ? 26 : 9); g.beginPath(); g.arc(w / 2 + Math.cos(a) * d, w / 2 + Math.sin(a) * d, r, 0, PI * 2); g.fill(); } });
    this.blobMat.map = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
    this.blobMat.alphaMap = this.blobMat.map; this.blobMat.map = null;
    const moonTex = canvasTex(256, 256, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(240,246,255,1)'); r.addColorStop(0.3, 'rgba(232,240,255,1)'); r.addColorStop(0.33, 'rgba(170,200,255,.35)'); r.addColorStop(1, 'rgba(120,170,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); g.fillStyle = 'rgba(150,170,205,.35)'; [[110, 104, 13], [146, 132, 9], [122, 150, 7], [150, 98, 6]].forEach((c) => { g.beginPath(); g.arc(c[0], c[1], c[2], 0, PI * 2); g.fill(); }); });
    const moon = add(new T.Sprite(new T.SpriteMaterial({ map: moonTex, color: hdr(1.5, 1.7, 2.1), fog: false, transparent: true, depthWrite: false }))); moon.scale.set(40, 40, 1); moon.position.set(-30, 50, -140);
    add(new T.HemisphereLight(0x7f9fe0, 0x14261f, 1.25));
    const moonL = add(new T.DirectionalLight(0xa9c6ff, 1.6)); moonL.position.set(-9, 16, -12);
    // a warm key from the front-left, like the light painted into the figures
    const key = add(new T.DirectionalLight(0xffc98a, 0.9)); key.position.set(-6, 8, 10);
    for (let i = 0; i < 18; i++) {
      const s = add(new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: 0x7fd1b4, transparent: true, opacity: 0.05 + Math.random() * 0.06, depthWrite: false })));
      const a = Math.random() * PI * 2, d = 26 + Math.random() * 40; s.position.set(Math.cos(a) * d, -6 + Math.random() * 5, Math.sin(a) * d - 30); const k = 20 + Math.random() * 24; s.scale.set(k, k * 0.5, 1); s.userData.v = (Math.random() - 0.5) * 0.6; this.mists.push(s);
    }
    const RN = 1500; this.rainPos = new Float32Array(RN * 6); this.rainG = new T.BufferGeometry();
    for (let i = 0; i < RN; i++) { const x = (Math.random() - 0.5) * 44, y = Math.random() * 22 - 2, z = (Math.random() - 0.5) * 44; this.rainPos.set([x, y, z, x + 0.05, y - 0.6, z], i * 6); }
    this.rainG.setAttribute('position', new T.BufferAttribute(this.rainPos, 3));
    this.rain = add(new T.LineSegments(this.rainG, new T.LineBasicMaterial({ color: 0xa8d8e8, transparent: true, opacity: 0.28 }))); this.rain.frustumCulled = false;
    this.ghostMat = new T.MeshBasicMaterial({ color: hdr(0.25, 0.6, 0.55), transparent: true, opacity: 0.12, depthWrite: false, fog: false });
    this.plankMat = new T.MeshStandardMaterial({ map: loadTex('bark', 1), roughness: 0.8, emissive: hdr(0.6, 0.45, 0.12), emissiveIntensity: 0.6 });
  }

  // ---------------------------------------------------------------- the areas
  /** shows one area, building it the first time */
  setArea(id: AreaId) {
    if (this.area === id) return;
    this.area = id; let b = this.areas.get(id); if (!b) { b = this.buildArea(id); this.areas.set(id, b); }
    for (const [k, a] of this.areas) a.group.visible = k === id;
    const pano = loadTex(id === 'terrace' ? 'backdrop' : id === 'forest' ? 'backdrop-forest' : 'backdrop-citadel'); pano.wrapS = T.MirroredRepeatWrapping; pano.repeat.x = 2; this.pano.map = pano; this.pano.needsUpdate = true;
    (this.scene.fog as T.FogExp2).color.set(id === 'forest' ? 0x10302e : 0x12283a); (this.scene.fog as T.FogExp2).density = id === 'forest' ? 0.02 : 0.014;
    for (const [, o] of this.pickups) o.parent?.remove(o); this.pickups.clear();
    this.camInit = false;
  }
  private buildArea(id: AreaId): AreaBuild {
    const A = AREAS[id], g = new T.Group(); this.scene.add(g);
    const b: AreaBuild = { group: g, planks: new Map(), gates: new Map(), stones: new Map(), posts: [], lamps: [] };
    const stoneT = loadTex('stone', 3), groundT = id === 'forest' ? loadTex('moss', 4) : stoneT;
    const ground = std(0xffffff, { map: groundT, roughness: 0.75 }), stone = std(0xe4ecf8, { map: stoneT, roughness: 0.8 }), dark = std(0x8e9cb2, { map: stoneT, roughness: 0.85 });
    const wood = std(0x3a2a24), roof = std(0xc8dcdc, { map: loadTex('roof', 2), roughness: 0.5 }), gold = std(0xd9a441, { roughness: 0.35, metalness: 0.9 }), lampM = glowM(hdr(1.25, 0.64, 0.17));
    // the walkable ground, standing on cliffs that drop into the mist
    A.walk.forEach((s, i) => {
      const y = -0.002 * i;
      if (s.k === 'rect') {
        const w = s.x1 - s.x0, d = s.z1 - s.z0, cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
        const top = mesh(new T.PlaneGeometry(w, d), ground, cx, y, cz, g); top.rotation.x = -PI / 2;
        const t = (top.material as T.MeshStandardMaterial); void t;
        mesh(box(w, 26, d), dark, cx, y - 13.05, cz, g);
      } else {
        const top = mesh(new T.CircleGeometry(s.r, 48), ground, s.x, y, s.z, g); top.rotation.x = -PI / 2;
        mesh(cyl(s.r, s.r * 0.8, 26, 32), dark, s.x, y - 13.05, s.z, g);
      }
    });
    const post = (x: number, z: number, light: boolean) => {
      const p = new T.Group(); p.position.set(x, 0, z); g.add(p); b.posts.push(p);
      mesh(box(0.22, 3.1, 0.22), wood, 0, 1.55, 0, p); mesh(box(0.2, 0.16, 1.1), wood, 0, 2.95, 0.4, p); mesh(box(1.3, 0.12, 0.5), roof, 0, 3.2, 0, p);
      mesh(box(0.02, 0.45, 0.02), wood, 0, 2.65, 0.8, p); const l = mesh(box(0.34, 0.46, 0.34), lampM, 0, 2.25, 0.8, p); mesh(box(0.42, 0.06, 0.42), wood, 0, 2.5, 0.8, p); mesh(box(0.42, 0.06, 0.42), wood, 0, 2.0, 0.8, p);
      const s = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: 0xffc45e, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false })); s.scale.set(3, 3, 1); s.position.copy(l.position); p.add(s);
      // the lamps sit high and well away from where figures stand, so a face next to one does not blow out
      if (light) { const pl = new T.PointLight(0xffb44d, 16, 14, 2); pl.position.set(0, 2.6, 0.8); p.add(pl); b.lamps.push(pl); }
      p.rotation.y = Math.atan2(-x, -z);
    };
    let nLamp = 0;
    const foliage = (cell: number, x: number, z: number, s = 1) => {
      const t = cellTex('foliage', cell), h = [4.6, 4.2, 1.4, 4.4][cell] * s, w = h * 0.95;
      const m = new T.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, side: T.DoubleSide, roughness: 1, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12 }); m.color.setScalar(0.7);
      const geo = new T.PlaneGeometry(w, h); geo.translate(0, h / 2 - h * 0.04, 0);
      // tall plants step out of the way when the camera comes close, like the lamp posts
      for (const r of [0, PI / 2]) { const p = mesh(geo, m, x, 0, z, g); p.rotation.y = r + (x * 7 + z * 13) % 1; if (cell !== 2) b.posts.push(p); }
    };
    for (const p of A.props) {
      switch (p.kind) {
        case 'post': post(p.x, p.z, nLamp++ % 2 === 0); break;
        case 'tree': foliage(1, p.x, p.z, p.s ?? 1); break;
        case 'fern': foliage(0, p.x, p.z, p.s ?? 1); break;
        case 'bush': foliage(2, p.x, p.z, p.s ?? 1); break;
        case 'bamboo': foliage(3, p.x, p.z, p.s ?? 1); break;
        case 'grove': { // a mossy rock pillar out of the mist with a tree, a fern or bamboo on top
          const r = 1.3 * (p.s ?? 1), cell = [1, 0, 3, 1, 0][Math.abs(Math.round(p.x * 3 + p.z * 5)) % 5];
          const top = mesh(new T.CircleGeometry(r, 20), ground, p.x, -0.12, p.z, g); top.rotation.x = -PI / 2;
          mesh(cyl(r, r * 0.7, 26, 14), dark, p.x, -13.13, p.z, g);
          foliage(cell, p.x, p.z, (p.s ?? 1) * (cell === 1 ? 1.15 : 1)); break;
        }
        case 'arena': this.buildArena(g, p.x, p.z, id); break;
        case 'temple': {
          const t = new T.Group(); t.position.set(p.x, 2.4, p.z); g.add(t);
          mesh(box(15, 2.4, 8), stone, 0, -1.2, 0, t); mesh(box(10.5, 3.6, 5.4), dark, 0, 1.8, 0, t);
          const tier = (w: number, y: number, s: number) => { const r = mesh(new T.ConeGeometry(w, 1.9 * s, 4), roof, 0, y, 0, t); r.rotation.y = PI / 4; r.scale.z = 0.62; };
          tier(9.4, 4.5, 1); mesh(box(6, 2.3, 3.4), dark, 0, 5.9, 0, t); tier(6, 7.9, 0.9); mesh(box(3, 1.6, 2), dark, 0, 8.9, 0, t); tier(3.6, 10.4, 0.8);
          [-3.4, 0, 3.4].forEach((x) => mesh(box(1.4, 2.2, 0.1), lampM, x, 1.2, 2.72, t));
          mesh(cyl(4, 7, 40, 8), dark, 0, -22, 0, t);
          break;
        }
        case 'bellhouse': {
          const h = new T.Group(); h.position.set(p.x, 0, p.z); g.add(h);
          mesh(box(2.8, 2.4, 6), dark, 0, 1.2, 0, h); const r = mesh(new T.ConeGeometry(3.6, 1.6, 4), roof, 0, 3.2, 0, h); r.rotation.y = PI / 4; r.scale.z = 1.9;
          const bell = mesh(new T.CylinderGeometry(0.25, 0.45, 0.7, 16), std(0x6f8f6a, { metalness: 0.7, roughness: 0.4 }), 1.7, 2.1, 3.6, h); bell.userData.bell = true;
          mesh(box(0.14, 2.6, 0.14), wood, 1.7, 1.3, 4.3, h); mesh(box(0.14, 2.6, 0.14), wood, 1.7, 1.3, 2.9, h); mesh(box(0.14, 0.14, 1.6), wood, 1.7, 2.6, 3.6, h);
          break;
        }
        case 'stairs': for (let i = 0; i < 8; i++) mesh(box(5.2, 0.18, 1.2), stone, p.x, -0.06 + 0.001 * i, p.z + 3.5 - i * 1.25, g); break;
        case 'gate': case 'jadegate': case 'jadedoor': {
          const gid = A.gates.find((o) => Math.abs((o.shape.k === 'rect' ? (o.shape.x0 + o.shape.x1) / 2 : 0) - p.x) < 1.6 && Math.abs((o.shape.k === 'rect' ? (o.shape.z0 + o.shape.z1) / 2 : 0) - p.z) < 1.6)?.id;
          const side = p.kind === 'jadedoor', w = side ? 4 : 5.6, gr = new T.Group(); gr.position.set(p.x, 0, p.z); if (side) gr.rotation.y = PI / 2; g.add(gr);
          for (const s of [-1, 1]) mesh(box(1.2, 4.8, 1.6), stone, s * (w / 2 + 0.6), 2.4, 0, gr);
          mesh(box(w + 2.6, 1, 1.8), stone, 0, 5.2, 0, gr); mesh(new T.ConeGeometry(0.4, 0.9, 4), gold, 0, 6.1, 0, gr);
          const door = new T.Group(); gr.add(door);
          mesh(box(w, 4.4, 0.4), wood, 0, 2.2, 0, door);
          for (let i = 0; i < 4; i++) mesh(box(w, 0.1, 0.45), gold, 0, 0.6 + i * 1.1, 0, door);
          if (p.kind !== 'gate') { const seal = mesh(new T.CircleGeometry(0.75, 32), glowM(hdr(0.3, 1.6, 0.9)), 0, 2.4, 0.23, door); seal.userData.seal = true; mesh(new T.CircleGeometry(0.75, 32), glowM(hdr(0.3, 1.6, 0.9)), 0, 2.4, -0.23, door).rotation.y = PI; }
          if (gid) b.gates.set(gid, door);
          break;
        }
        case 'condorgate': {
          const cg = new T.Group(); cg.position.set(p.x, 0, p.z); g.add(cg);
          for (const s of [-1, 1]) { mesh(box(2.4, 9, 2.4), stone, s * 4.4, 4.5, 0, cg); mesh(new T.ConeGeometry(1.2, 1.4, 4), gold, s * 4.4, 9.7, 0, cg).rotation.y = PI / 4; }
          mesh(box(11.4, 1.8, 2.6), stone, 0, 9.4, 0, cg);
          // stone condor wings over the gate
          for (const s of [-1, 1]) { const wgt = mesh(box(5.5, 0.5, 0.6), dark, s * 3.2, 11, 0, cg); wgt.rotation.z = s * 0.25; }
          mesh(cyl(0.7, 0.9, 1.4, 8), gold, 0, 10.9, 0, cg);
          b.sunLamp = mesh(new T.SphereGeometry(0.9, 24, 16), glowM(hdr(0.18, 0.16, 0.14)), 0, 12.3, 0, cg);
          b.sunLight = new T.PointLight(0xffc060, 0, 60, 1.6); b.sunLight.position.set(0, 12.3, 1.5); cg.add(b.sunLight);
          mesh(box(6.4, 7.2, 0.5), std(0x0a1018), 0, 3.6, 0.2, cg);
          mesh(cyl(30, 18, 40, 10), dark, 0, -20.5, -6, cg);
          break;
        }
        case 'walls': {
          const wall = (x0: number, z0: number, x1: number, z1: number, h = 6) => { const l = Math.hypot(x1 - x0, z1 - z0), m = mesh(box(l, h, 1.2), stone, (x0 + x1) / 2, h / 2 - 0.2, (z0 + z1) / 2, g); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); };
          wall(-14, -5.4, -3.6, -5.4); wall(3.6, -5.4, 14, -5.4); wall(-14, -24.8, -3.2, -24.8, 7); wall(3.2, -24.8, 14, -24.8, 7);
          wall(-13.8, -24.8, -13.8, -17.6); wall(-13.8, -12.4, -13.8, -5.4); wall(13.8, -24.8, 13.8, -12.6); wall(13.8, -8.4, 13.8, -5.4);
          for (const [x, z] of [[-14, -5.4], [14, -5.4], [-14, -24.8], [14, -24.8]]) { mesh(box(2.4, 8.5, 2.4), stone, x, 4, z, g); const r = mesh(new T.ConeGeometry(2, 1.8, 4), roof, x, 9.1, z, g); r.rotation.y = PI / 4; }
          break;
        }
        case 'gorge': case 'gorge2': {
          // the drop: dark water far below, mist drifting in it
          const horiz = p.kind === 'gorge2', len = horiz ? 10.6 : 17.5;
          for (let i = 0; i < 6; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: 0x9fe0d0, transparent: true, opacity: 0.16, depthWrite: false })); s.position.set(p.x + (horiz ? (i / 5 - 0.5) * len : (Math.sin(i * 3) * 2)), -3 - (i % 3) * 2, p.z + (horiz ? Math.sin(i * 3) * 2 : (i / 5 - 0.5) * len)); s.scale.set(9, 4, 1); g.add(s); this.mists.push(s); s.userData.v = 0; }
          break;
        }
        case 'ropeposts': case 'ropeposts2': {
          const horiz = p.kind === 'ropeposts2';
          for (const s of [-1, 1]) { const m = mesh(box(0.2, 1.4, 0.2), wood, p.x + (horiz ? 0 : s * 1.5), 0.7, p.z + (horiz ? s * 1.5 : 0), g); void m; }
          break;
        }
        case 'shrine': { mesh(box(2.4, 2.2, 2.4), dark, p.x, 1.1, p.z, g); const r = mesh(new T.ConeGeometry(2.2, 1.2, 4), roof, p.x, 2.8, p.z, g); r.rotation.y = PI / 4; mesh(box(0.8, 1.1, 0.1), lampM, p.x, 0.9, p.z + 1.22, g); break; }
      }
    }
    // the spirit-bridge planks: a faint shimmer until the lantern wakes them
    for (const pl of A.planks) {
      const m = mesh(box(pl.hx * 2 - 0.08, 0.12, pl.hz * 2 - 0.08), this.ghostMat, pl.x, -0.07, pl.z, g); m.userData.lit = 0; b.planks.set(pl.id, m);
    }
    // the ropes along the bridges
    const ropeM = new T.LineBasicMaterial({ color: 0x7a6650 });
    const rope = (x0: number, z0: number, x1: number, z1: number) => { for (const s of [-1, 1]) { const pts: T.Vector3[] = []; const nx = -(z1 - z0), nz = x1 - x0, l = Math.hypot(nx, nz); for (let i = 0; i <= 24; i++) { const k = i / 24; pts.push(new T.Vector3(mix(x0, x1, k) + nx / l * s * 1.5, 1.1 - Math.sin(k * PI) * 0.6, mix(z0, z1, k) + nz / l * s * 1.5)); } g.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), ropeM)); } };
    if (id === 'forest') { rope(11, -26.9, 11, -44.7); rope(2.1, -48.5, -9.6, -48.5); }
    // stones with a carving: the sun-stone and the three worlds
    for (const s of STONES.filter((o) => o.area === id)) {
      const cell = { serpent: 0, puma: 1, condor: 2, sun: 3 }[s.glyph], t = cellTex('carvings', cell);
      const st = new T.Group(); st.position.set(s.x, 0, s.z); st.rotation.y = s.face; g.add(st);
      mesh(box(1.3, 2.4, 0.9), dark, 0, 1.2, 0, st);
      const face = mesh(new T.PlaneGeometry(1.15, 1.15), new T.MeshStandardMaterial({ map: t, emissive: hdr(1.6, 1.1, 0.35), emissiveMap: t, emissiveIntensity: 0, roughness: 0.7 }), 0, 1.5, 0.46, st);
      b.stones.set(s.id, face);
    }
    return b;
  }
  /** the round paved floor with the wet reflection, where the duels on the terrace and at the gate are fought */
  private buildArena(g: T.Group, x: number, z: number, id: AreaId) {
    const R = 9.0, stone = std(0xe4ecf8, { map: loadTex('stone', 3), roughness: 0.8 });
    const floorMat = new T.MeshStandardNodeMaterial({ map: loadTex('floor'), roughness: 0.32, metalness: 0.15 });
    if (this.fxOn && id === 'terrace') {
      const refl = reflector({ resolutionScale: 0.5, samples: 4 }); refl.target.rotateX(-PI / 2); refl.target.position.set(x, 0.008, z); g.add(refl.target);
      const wp = positionWorld.mul(1.9); refl.uvNode = refl.uvNode!.add(vec2(mx_noise_float(wp), mx_noise_float(wp.add(11.3))).mul(0.0035));
      floorMat.emissiveNode = refl.rgb.mul(0.3);
    }
    const floor = mesh(new T.CircleGeometry(R, 64), floorMat, x, 0.008, z, g); floor.rotation.x = -PI / 2;
    mesh(new T.TorusGeometry(R + 0.05, 0.16, 8, 64), stone, x, 0.1, z, g).rotation.x = PI / 2;
  }

  // ---------------------------------------------------------------- the figures
  private buildFigures() {
    // Enzo's lantern: a warm light and glow that follow the top of his staff
    this.staffL = new T.PointLight(0xffc45e, 10, 9, 2); this.scene.add(this.staffL);
    this.lanternGlow = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: 0xffc45e, transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false })); this.lanternGlow.scale.set(1.4, 1.4, 1); this.scene.add(this.lanternGlow);
    this.lanternRing = mesh(new T.RingGeometry(0.92, 1, 64), new T.MeshBasicMaterial({ color: hdr(1.6, 1.2, 0.5), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }), 0, 0.05, 0, this.scene);
    this.lanternRing.rotation.x = -PI / 2;
  }
  private card(key: string, who: string) {
    let c = this.cards.get(key);
    if (!c) { c = new Card(who, loadTex(`sprites/${who}`), this.blobMat); this.scene.add(c.o); this.cards.set(key, c); }
    c.o.visible = true; return c;
  }
  /** how far a figure has walked, for its walk cycle */
  private stride(key: string, x: number, z: number) {
    const l = this.lastPos.get(key); let d = this.walked.get(key) ?? 0;
    if (l) { const s = Math.hypot(x - l.x, z - l.z); if (s < 2) d += s; }
    this.lastPos.set(key, { x, z }); this.walked.set(key, d); return d;
  }

  // ---------------------------------------------------------------- effects
  private buildEffects() {
    const sc = this.scene, gold = hdr(2.4, 1.25, 0.22);
    sc.add(this.trailBox);
    const defs: [number, number, number, [number, number, number]][] = [[1.25, 1.85, 3.3, [PI / 2, 0, -0.1]], [1.3, 1.95, 3.4, [PI / 2 - 0.55, 0, 0]], [1.4, 2.2, 3.5, [0, PI / 2, 0.6]]];
    defs.forEach(([r0, r1, len, rot], i) => { const m = new T.Mesh(arcGeo(r0, r1, len), addMat(gold, true)); m.rotation.set(rot[0], rot[1], rot[2]); if (i === 1) m.scale.x = -1; m.visible = false; m.frustumCulled = false; m.position.y = 0.95; this.trailBox.add(m); this.trails.push(m); });
    this.tagRing = mesh(new T.RingGeometry(0.82, 1, 64), addMat(hdr(3.2, 2.2, 0.8)), 0, 0.2, 0, sc); this.tagRing.rotation.x = -PI / 2; this.tagRing.visible = false;
    this.jadeRing = mesh(new T.RingGeometry(0.9, 1, 64), addMat(hdr(0.5, 2.6, 1.6)), 0, 0.06, 0, sc); this.jadeRing.rotation.x = -PI / 2; this.jadeRing.visible = false;
    this.mark = mesh(new T.RingGeometry(0.86, 1, 40), addMat(hdr(1.6, 1.1, 0.4)), 0, 0.05, 0, sc); this.mark.rotation.x = -PI / 2; (this.mark.material as T.MeshBasicMaterial).opacity = 0.7;
    this.finish = mesh(new T.OctahedronGeometry(0.2), glowM(hdr(3, 2, 0.6)), 0, 0, 0, sc); this.finish.visible = false;
    this.glint = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: hdr(3, 2.2, 1), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })); sc.add(this.glint);
    this.sparks = new T.InstancedMesh(box(0.028, 0.028, 0.2), glowM(hdr(5, 3, 0.9)), 140); this.sparks.frustumCulled = false; sc.add(this.sparks);
    for (let i = 0; i < 140; i++) { this.sP.push(new T.Vector3(0, -999, 0)); this.sV.push(new T.Vector3(0, 1, 0)); }
  }
  private burst(x: number, y: number, z: number, n: number, sp: number) {
    for (let i = 0; i < n; i++) { const j = this.sNext++ % 140, a = Math.random() * PI * 2, u = Math.random() * 2 - 1, q = Math.sqrt(1 - u * u), v = sp * (0.4 + Math.random()); this.sP[j].set(x, y, z); this.sV[j].set(Math.cos(a) * q * v, Math.abs(u) * v + 1, Math.sin(a) * q * v); this.sLife[j] = 0.5 + Math.random() * 0.5; }
  }
  private puff(x: number, y: number, z: number, size: number, color: T.ColorRepresentation, ink: boolean, life = 0.35) {
    const mat = new T.SpriteMaterial({ map: ink ? this.inkTex : this.softTex, color, transparent: true, opacity: 1, blending: ink ? T.NormalBlending : T.AdditiveBlending, depthWrite: false, fog: false, rotation: Math.random() * 6 });
    // the painted figures are smaller than the old rigs: keep the flashes off their faces
    if (!ink) { size *= 0.5; mat.opacity = 0.6; mat.color.multiplyScalar(0.6); } y *= 0.8;
    const s = new T.Sprite(mat); s.position.set(x, y, z); s.scale.setScalar(size); this.scene.add(s); this.fx.push({ o: s, mat, life, max: life, grow: ink ? 1.4 : 0.6, s0: size });
  }
  /** a point in the fight's frame, in the world */
  private L(x: number, z: number) { return duelToWorld(this.duel, x, z); }

  /** the fight's events, as they happen */
  event(e: FightEvent, g: Fight, reduced = false) {
    const kick = (n: number) => { if (!reduced) this.shake = Math.max(this.shake, n); };
    const at = (x: number, z: number) => this.L(x, z);
    switch (e.t) {
      case 'swing': { const m = this.trails[e.n]; m.userData.life = 1; break; }
      case 'hit': { const p = at(e.x, e.z); this.puff(p.x, 1.1, p.z, 1.2, 0x0c1238, true, 0.45); this.puff(p.x, 1.1, p.z, e.heavy ? 2.1 : 1.3, hdr(1.5, 1.05, 0.45), false); this.burst(p.x, 1.1, p.z, e.heavy ? 22 : 12, 4); kick(e.heavy ? 0.16 : 0.08); break; }
      case 'deflect': { const p = at(e.x, e.z); this.puff(p.x, 1.3, p.z, 2.6, hdr(1.8, 1.3, 0.55), false, 0.4); this.burst(p.x, 1.3, p.z, 38, 5.5); kick(0.25); break; }
      case 'block': { const p = at(e.x, e.z); this.puff(p.x, 1.2, p.z, 1.1, hdr(0.8, 0.9, 1.2), false, 0.25); this.burst(p.x, 1.2, p.z, 8, 3); kick(0.1); break; }
      case 'parried': { const p = at(e.x, e.z); this.parryT.set(e.id, 24); this.puff(p.x, 1.2, p.z, 1.5, hdr(0.9, 1.3, 1.4), false, 0.3); this.burst(p.x, 1.2, p.z, 14, 4); kick(0.12); break; }
      case 'hurt': { const p = at(g.x, g.z); this.puff(p.x, 1.0, p.z, 1.7, e.jade ? hdr(0.4, 1.6, 1.0) : hdr(1.6, 0.6, 0.3), false, 0.3); this.puff(p.x, 0.9, p.z, 1.1, 0x0c1238, true, 0.4); kick(0.28); break; }
      case 'finisherHit': { const p = at(e.x, e.z); this.puff(p.x, 1.1, p.z, 4, hdr(2, 1.4, 0.5), false, 0.5); this.puff(p.x, 1.1, p.z, 2.4, 0x0c1238, true, 0.6); this.burst(p.x, 1.1, p.z, 50, 6.5); kick(0.32); break; }
      case 'tagHit': { const p = at(e.x, e.z); this.tagRing.position.set(p.x, 0.2, p.z); this.tagRing.userData.life = 1; this.puff(p.x, 1.2, p.z, 4.5, hdr(2, 1.5, 0.6), false, 0.5); this.burst(p.x, 1.0, p.z, 50, 6); kick(0.3); break; }
      case 'broken': { const f = g.foe(e.id); if (f) { const p = at(f.x, f.z); this.puff(p.x, 1.2, p.z, 3, hdr(1.8, 1.3, 0.5), false, 0.45); this.burst(p.x, 1.2, p.z, 24, 5); } kick(0.2); break; }
      case 'dead': { const f = g.foe(e.id); if (f) { const p = at(f.x, f.z); this.puff(p.x, 0.8, p.z, 2.6, 0x0c1238, true, 0.9); } break; }
      case 'guardBroken': { const p = at(g.x, g.z); this.puff(p.x, 1.1, p.z, 2.2, hdr(0.9, 1, 1.4), false, 0.4); kick(0.22); break; }
    }
  }
  /** the world's events: the lantern, waking planks and stones, gates, pickups */
  worldEvent(e: WorldEvent, w: World) {
    const b = this.areas.get(w.area);
    switch (e.t) {
      case 'lantern': this.lanternRing.position.set(e.x, 0.05, e.z); this.lanternRing.userData.life = 1; this.lanternRing.userData.r = e.r; this.puff(w.enzo.x, 2.2, w.enzo.z, 3.4, hdr(2, 1.5, 0.6), false, 0.6); break;
      case 'plank': { const m = b?.planks.get(e.id); if (m) { m.material = this.plankMat; m.userData.lit = 0.01; this.burst(m.position.x, 0.3, m.position.z, 10, 2); } break; }
      case 'stone': { const s = b?.stones.get(e.id); if (s) { const p = new T.Vector3(); s.getWorldPosition(p); this.puff(p.x, p.y, p.z, 2.4, hdr(2, 1.5, 0.5), false, 0.6); this.burst(p.x, p.y, p.z, 20, 3); } break; }
      case 'stonesReset': for (const [, s] of b?.stones ?? []) { const p = new T.Vector3(); s.getWorldPosition(p); this.puff(p.x, p.y, p.z, 1.6, 0x0c1238, true, 0.6); } break;
      case 'gate': { const d = b?.gates.get(e.id); if (d) { const p = new T.Vector3(); d.getWorldPosition(p); this.burst(p.x, 2.4, p.z, 40, 4); this.puff(p.x, 2.4, p.z, 4, e.id === 'sun' || e.id === 'worlds' ? hdr(2, 1.5, 0.5) : hdr(0.5, 2, 1.2), false, 0.8); } break; }
      case 'got': { const o = this.pickups.get(e.id); if (o) { this.burst(o.position.x, 0.6, o.position.z, 30, 3); } break; }
      case 'cold': this.coldT = 0.8; break;
      case 'travel': this.setArea(e.to); break;
    }
  }

  // ---------------------------------------------------------------- one frame
  render(v: View, dt: number, reduced = false) {
    this.now += dt; const now = this.now;
    const w = v.kind === 'story' ? v.world : null, g = v.fight;
    if (w) this.setArea(w.area); else this.setArea('terrace');
    const b = this.areas.get(this.area!)!;
    const fighting = !!g && (!w || w.mode === 'duel');
    this.duel = w?.duel ?? (w ? this.duel : ARENA_DUEL);
    for (const [, c] of this.cards) c.o.visible = false;
    const yaw = this.yaw;
    const talkLine = w?.mode === 'talk' ? w.line : null;
    if (talkLine !== this.lastLine) { this.lastLine = talkLine; this.talkT = 0; } else this.talkT += dt;
    // a speaker moves their mouth while the line is being read out, then rests
    const speaking = (who: Who) => talkLine?.who === who && this.talkT < Math.min(2.4, 0.4 + (talkLine?.text.length ?? 0) * 0.028);
    const talkFrame = (who: Who, a: string, bb: string) => speaking(who) ? (Math.floor(this.talkT * 3.2) % 2 ? bb : a) : null;

    let dx = 0, dz = 0, ex = 0, ez = 0;
    if (fighting && g) {
      // ---------------------------------------- the duel, side-on
      const p = this.L(g.x, g.z); dx = p.x; dz = p.z;
      const dc = this.card('dora', 'dora'), fWorld = g.face + this.duel.rot;
      dc.set(doraFightFrame(g, this.stride('dora', dx, dz)), Card.mirrorFor(fWorld, yaw));
      dc.y = g.state === 'finisher' && g.t < FINISHER.hit ? Math.sin((g.t / FINISHER.hit) * PI) * 1.1 : 0;
      dc.spin = g.state === 'dodge' && g.t < 14 ? (Card.mirrorFor(fWorld, yaw) ? 1 : -1) * (g.t / 14) * PI * 2 : 0;
      dc.alpha = 1; dc.bob = 0; dc.update(dx, dz, yaw);
      const e = this.L(g.enzo.x, g.enzo.z); ex = e.x; ez = e.z;
      const ec = this.card('enzo', 'enzo'), eFace = g.enzo.face + this.duel.rot;
      let ef = 'ready', ey = 0;
      if (g.enzo.state === 'leap') { ef = 'leap'; ey = Math.sin(Math.min(1, g.enzo.t / 22) * PI) * 1.3; }
      else if (g.enzo.state === 'strike') ef = g.enzo.t < 24 ? 'strike' : 'ready';
      else if (g.enzo.state === 'back') ef = walkCycle('walk-side', this.stride('enzo', ex, ez), 0.42);
      else if (g.phase === 'won') ef = 'cheer';
      else if (g.state === 'hit' || g.state === 'dead') ef = 'brace';
      ec.set(ef, Card.mirrorFor(eFace, yaw)); ec.y = ey; ec.spin = 0; ec.alpha = 1; ec.bob = 0; ec.update(ex, ez, yaw);
      for (const f of g.foes) {
        if (f.gone) continue;
        const fp = this.L(f.x, f.z), c = this.card(`foe${f.id}-${f.look}`, f.look);
        const pt = this.parryT.get(f.id) ?? 0; if (pt > 0) this.parryT.set(f.id, pt - dt * 60);
        c.set(foeFightFrame(f, this.stride(`foe${f.id}`, fp.x, fp.z), pt > 0), Card.mirrorFor(f.face + this.duel.rot, yaw));
        c.y = f.look === 'titu' && f.atk?.id === 'pounce' && f.state === 'windup' && f.t > f.atk.windup - 8 ? Math.sin(((f.t - (f.atk.windup - 8)) / 14) * PI) * 0.6 : 0;
        c.alpha = f.state === 'dead' ? Math.max(0, 1 - Math.max(0, f.t - 40) / 50) : 1; c.spin = 0; c.bob = 0;
        c.update(fp.x, fp.z, yaw);
      }
      this.fightFx(g, dt, now);
    } else if (w) {
      // ---------------------------------------- exploring and talking
      dx = w.x; dz = w.z; ex = w.enzo.x; ez = w.enzo.z;
      const dc = this.card('dora', 'dora'); dc.y = 0; dc.spin = 0; dc.alpha = 1;
      const vw = view(w.face, yaw), dWalk = this.stride('dora', dx, dz);
      let df: string, dm = Card.mirrorFor(w.face, yaw);
      if (w.mode === 'pickup') { df = w.t < PICKUP.at + 4 ? 'pickup-a' : 'pickup-b'; }
      else if (w.mode === 'talk') { df = talkFrame('dora', talkLine?.mood ? 'talk-c' : 'talk-a', 'talk-b') ?? 'idle-side'; }
      else if (w.mode === 'end') { df = 'win'; }
      else if (w.moving) df = walkCycle(`walk-${vw}`, dWalk, 0.4);
      else df = `idle-${vw}`;
      dc.bob = w.moving || w.mode === 'talk' ? 0 : Math.sin(now * 2.2) * 0.008;
      dc.set(df, dm); dc.update(dx, dz, yaw);
      const ec = this.card('enzo', 'enzo'); ec.y = 0; ec.spin = 0; ec.alpha = 1;
      const evw = view(w.enzo.face, yaw), eWalk = this.stride('enzo', ex, ez);
      let ef: string;
      if (w.mode === 'lantern') ef = this.coldT > 0 && w.t > LANTERN.at ? 'lantern-sweep' : 'lantern-up';
      else if (w.mode === 'talk') ef = talkFrame('enzo', talkLine?.mood ? 'talk-b' : 'talk-a', talkLine?.mood ? 'talk-a' : 'talk-b') ?? 'idle-side';
      else if (w.mode === 'end') ef = 'lantern-up';
      else if (w.enzo.moving) ef = walkCycle(`walk-${evw}`, eWalk, 0.4);
      else ef = `idle-${evw}`;
      ec.bob = w.enzo.moving ? 0 : Math.sin(now * 2 + 1) * 0.008;
      ec.set(ef, Card.mirrorFor(w.enzo.face, yaw)); ec.update(ex, ez, yaw);
      // the people of the mountain
      for (const n of w.npcs()) {
        const look = n.who, c = this.card(`npc-${n.id}`, look); c.y = 0; c.spin = 0; c.alpha = 1;
        const facing = w.talk?.who === n.id || n.who === talkLine?.who ? Math.atan2(dx - n.x, dz - n.z) : n.face;
        let f: string;
        if (look === 'qori' || look === 'tupa') f = talkFrame(look, 'talk-a', 'talk-b') ?? (view(facing, yaw) === 'front' && w.mode !== 'talk' ? 'idle-front' : 'idle-side');
        else f = speaking(look) ? 'talk' : 'idle';
        c.bob = speaking(look) ? Math.abs(Math.sin(this.talkT * 9)) * 0.02 : 0;
        c.set(f, Card.mirrorFor(facing, yaw)); c.update(n.x, n.z, yaw);
      }
      // foes waiting for their duel; after a duel the one who lost talks, then bows
      for (const d of DUELS.filter((o) => o.area === w.area)) {
        const after = w.talk?.scene === d.after, waiting = !w.won(d.id) && w.mode !== 'duel';
        if (!after && !waiting) continue;
        d.stand.forEach((s, i) => {
          if (after && i > 0) return;
          const look = d.foes[i].look, c = this.card(`stand-${d.id}-${i}`, look); c.y = 0; c.spin = 0; c.alpha = 1;
          const tw: Who = look === 'ukhu' ? 'ukhu' : look === 'atoq' ? 'atoq' : look === 'titu' ? 'titu' : look === 'mallku' ? 'mallku' : 'kin';
          const facing = w.mode === 'talk' && (after || w.talk?.scene === d.before) ? Math.atan2(dx - s.x, dz - s.z) : s.face;
          let f = 'idle';
          if (look === 'ukhu') f = talkFrame('ukhu', 'talk-a', 'talk-b') ?? (after || w.mode === 'end' ? 'bow' : 'idle');
          else f = speaking(tw) && i === (talkLine && w.talk?.scene === d.before ? Math.min(i, 0) : 0) ? 'talk' : after ? 'bow' : 'idle';
          c.bob = speaking(tw) ? Math.abs(Math.sin(this.talkT * 9)) * 0.02 : 0;
          c.set(f, Card.mirrorFor(facing, yaw)); c.update(s.x, s.z, yaw);
        });
      }
      if (w.mode === 'end' && b.sunLamp) {
        // the Sun Lamp catches
        const m = b.sunLamp.material as T.MeshBasicMaterial; m.color.lerp(hdr(4, 2.6, 0.9), Math.min(1, dt * 0.8));
        if (b.sunLight) b.sunLight.intensity = Math.min(900, b.sunLight.intensity + dt * 300);
      }
      this.hideFightFx(dt);
    }
    // Enzo's lantern light sits at the top of his staff
    const lanternUp = w?.mode === 'lantern' ? w.enzo.lantern : 0;
    this.staffL.position.set(ex, 2.3 + lanternUp * 0.6, ez); this.staffL.intensity = 8 + lanternUp * 30;
    this.lanternGlow.position.set(ex, 2.25 + lanternUp * 0.6, ez); this.lanternGlow.scale.setScalar(1.2 + lanternUp * 1.6);
    this.coldT = Math.max(0, this.coldT - dt);
    const lr = (this.lanternRing.userData.life as number) || 0;
    if (lr > 0) { const l = Math.max(0, lr - dt * 1.1); this.lanternRing.userData.life = l; this.lanternRing.scale.setScalar(0.3 + (1 - l) * ((this.lanternRing.userData.r as number) || LANTERN.r)); (this.lanternRing.material as T.MeshBasicMaterial).opacity = l * 0.9; }
    // pickups bob and glow
    if (w && !fighting) {
      const live = new Set<string>();
      for (const p of w.pickups()) {
        live.add(p.id); let o = this.pickups.get(p.id);
        if (!o) {
          const it = ITEMS[p.id], cell = it.kind === 'quipu' ? 0 : p.id === 'feather' || p.id === 'edge' ? 1 : p.id === 'jade' ? 2 : 3, t = cellTex('props', cell);
          o = new T.Group(); o.position.set(p.x, 0, p.z); this.scene.add(o);
          const card = mesh(new T.PlaneGeometry(0.75, 0.75), new T.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.2, side: T.DoubleSide, color: 0xdddddd }), 0, 0.7, 0, o); card.name = 'card';
          const glow = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: it.kind === 'quipu' ? 0xffd27a : 0x9ff0d0, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false })); glow.scale.set(1.6, 1.6, 1); glow.position.y = 0.7; o.add(glow);
          this.pickups.set(p.id, o);
        }
        const c = o.getObjectByName('card')!; c.position.y = 0.7 + Math.sin(now * 2 + p.x) * 0.08; c.rotation.y = yaw + PI;
      }
      for (const [id, o] of this.pickups) if (!live.has(id)) { this.scene.remove(o); this.pickups.delete(id); }
    }
    for (const [, o] of this.pickups) o.visible = !fighting;
    // planks and stones glow up once woken; gates sink away when open
    if (w) {
      for (const [id, m] of b.planks) { const lit = w.isLit(id); if (lit && m.material !== this.plankMat) m.material = this.plankMat; m.visible = lit || (w.mode === 'lantern' || Math.sin(now * 1.5 + m.position.x + m.position.z) > -0.2); m.position.y = lit ? -0.06 : -0.08 + Math.sin(now * 2 + m.position.z) * 0.02; }
      for (const [id, s] of b.stones) { const mat = s.material as T.MeshStandardMaterial, want = w.isLit(id) ? 1.2 : 0; mat.emissiveIntensity += (want - mat.emissiveIntensity) * Math.min(1, dt * 4); }
      for (const gate of AREAS[w.area].gates) { const d = b.gates.get(gate.id); if (d) { const open = w.gateOpen(gate); d.position.y += ((open ? -4.6 : 0) - d.position.y) * Math.min(1, dt * 1.5); d.visible = d.position.y > -4.5; } }
    } else { for (const gate of AREAS.terrace.gates) { const d = b.gates.get(gate.id); if (d) d.position.y = 0; } }
    this.plankMat.emissiveIntensity = 0.5 + Math.sin(now * 2) * 0.1;
    this.runFx(dt);
    b.lamps.forEach((l, i) => { l.intensity = 16 + Math.sin(now * 5 + i * 2) * 1.5; });
    this.camera(v, dt, dx, dz);
    // nothing tall right in front of the lens
    for (const post of b.posts) post.visible = Math.hypot(post.position.x - this.camPos.x, post.position.z - this.camPos.z) > 3.6;
    // rain falls round the camera
    this.rain.position.set(this.camPos.x, 0, this.camPos.z);
    if (this.pipe) this.pipe.render(); else this.renderer.render(this.scene, this.cam);
  }

  private fightFx(g: Fight, dt: number, now: number) {
    // tells: a glint at the weapon as a steel attack is about to land, a jade ring for one that cannot be guarded
    const threat = g.foes.find((f) => (f.state === 'windup' || f.state === 'strike') && f.atk), gm = this.glint.material as T.SpriteMaterial, jm = this.jadeRing.material as T.MeshBasicMaterial;
    if (threat && threat.atk && threat.state === 'windup') {
      const a = threat.atk, u = threat.t / a.windup, p = this.L(threat.x, threat.z), big = threat.kind === 'bear', fw = threat.face + this.duel.rot;
      this.glint.position.set(p.x + Math.sin(fw) * (big ? 1.2 : 0.7) - Math.sin(this.yaw) * 0.3, big ? 1.9 : 1.2, p.z + Math.cos(fw) * (big ? 1.2 : 0.7) - Math.cos(this.yaw) * 0.3);
      gm.color.copy(a.jade ? hdr(0.35, 2, 1.2) : hdr(2, 1.5, 0.7)); gm.opacity = Math.min(1, u * 1.6); this.glint.scale.setScalar(0.3 + Math.pow(u, 3) * 0.9);
      if (a.jade) { this.jadeRing.visible = true; this.jadeRing.position.set(p.x, 0.06, p.z); this.jadeRing.scale.setScalar(a.range + 0.35 + (a.lunge > 0 ? a.lunge : 0)); jm.opacity = 0.25 + u * 0.75; } else this.jadeRing.visible = false;
    } else { gm.opacity = Math.max(0, gm.opacity - 0.016 * 6); jm.opacity = Math.max(0, jm.opacity - 0.016 * 4); if (jm.opacity <= 0) this.jadeRing.visible = false; }
    const tg = g.targetFoe; this.mark.visible = !!tg && g.phase !== 'won';
    if (tg) { const p = this.L(tg.x, tg.z), rr = tg.kind === 'bear' ? 1.25 : 0.75; this.mark.position.set(p.x, 0.05, p.z); this.mark.scale.setScalar(rr + Math.sin(now * 4) * 0.04); }
    const open = g.living.find((f) => f.state === 'broken'); this.finish.visible = !!open;
    if (open) { const p = this.L(open.x, open.z); this.finish.position.set(p.x, (open.kind === 'bear' ? 3.2 : 2.2) + Math.sin(now * 5) * 0.12, p.z); this.finish.rotation.y = now * 3; }
    const d = this.L(g.x, g.z); this.trailBox.position.set(d.x, 0, d.z); this.trailBox.rotation.y = g.face + this.duel.rot;
    this.trails.forEach((m, i) => { const life = (m.userData.life as number) || 0, c = CUTS[i], on = g.state === `cut${i + 1}` && g.t >= c.hit - 3; const l = on ? Math.max(0, life - dt * 3.2) : Math.max(0, life - dt * 6); m.userData.life = l; const show = on && l > 0; m.visible = show; (m.material as T.MeshBasicMaterial).opacity = show ? l : 0; });
    const tl = (this.tagRing.userData.life as number) || 0; if (tl > 0) { const l = Math.max(0, tl - dt * 1.7); this.tagRing.userData.life = l; this.tagRing.visible = l > 0; this.tagRing.scale.setScalar(0.5 + (1 - l) * TAG.radius); (this.tagRing.material as T.MeshBasicMaterial).opacity = l; }
  }
  private hideFightFx(dt: number) {
    this.mark.visible = false; this.finish.visible = false; this.jadeRing.visible = false; (this.glint.material as T.SpriteMaterial).opacity = 0;
    for (const m of this.trails) m.visible = false;
    const tl = (this.tagRing.userData.life as number) || 0; if (tl > 0) { this.tagRing.userData.life = Math.max(0, tl - dt * 1.7); } else this.tagRing.visible = false;
  }
  private runFx(dt: number) {
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.life -= dt; const u = Math.max(0, f.life / f.max); (f.mat as T.SpriteMaterial).opacity = u; f.o.scale.setScalar(f.s0 * (1 + (1 - u) * f.grow)); if (f.life <= 0) { this.scene.remove(f.o); f.mat.dispose(); this.fx.splice(i, 1); } }
    for (let i = 0; i < 140; i++) {
      if (this.sLife[i] > 0) { this.sLife[i] -= dt; this.sV[i].y -= 9 * dt; this.sP[i].addScaledVector(this.sV[i], dt); this.dum.position.copy(this.sP[i]); this.dum.lookAt(this.sP[i].x + this.sV[i].x, this.sP[i].y + this.sV[i].y, this.sP[i].z + this.sV[i].z); this.dum.scale.setScalar(Math.max(0, Math.min(1, this.sLife[i] * 3))); }
      else { this.dum.position.set(0, -999, 0); this.dum.scale.setScalar(0); }
      this.dum.updateMatrix(); this.sparks.setMatrixAt(i, this.dum.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = true;
    const rp = this.rainPos; for (let i = 0; i < rp.length / 6; i++) { const j = i * 6; let y = rp[j + 1] - 26 * dt; if (y < -3) y += 22; rp[j + 1] = y; rp[j + 4] = y - 0.6; }
    this.rainG.attributes.position.needsUpdate = true;
    for (const m of this.mists) { m.position.x += (m.userData.v as number) * dt; if (m.position.x > 80) m.position.x = -80; if (m.position.x < -80) m.position.x = 80; }
  }

  // ---------------------------------------------------------------- the camera
  private camera(v: View, dt: number, dx: number, dz: number) {
    const w = v.kind === 'story' ? v.world : null, g = v.fight, fighting = !!g && (!w || w.mode === 'duel');
    let tx: number, tz: number, ty: number, lx: number, lz: number, ly = 1.15, rate = 4;
    const phone = this.cam.aspect < 1;
    // side-on framing of two points: the camera sits off the line between them, on whichever side it already is
    const side = (ax: number, az: number, bx: number, bz: number, extra: number, h: number, away?: { x: number; z: number }) => {
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, ddx = bx - ax, ddz = bz - az, l = Math.hypot(ddx, ddz) || 1;
      let nx = ddz / l, nz = -ddx / l; if ((this.camPos.x - mx) * nx + (this.camPos.z - mz) * nz < 0) { nx = -nx; nz = -nz; }
      // in a duel, watch from the side Enzo is not on, so he never stands in front of the camera
      if (away) { const e = (away.x - mx) * nx + (away.z - mz) * nz; if (e > 1.2) { nx = -nx; nz = -nz; } }
      const dist = (Math.max(4.6, l * 1.05 + extra)) * (phone ? 1.7 : 1);
      return { x: mx + nx * dist, z: mz + nz * dist, y: h, lx: mx, lz: mz };
    };
    if (fighting && g) {
      const tg = g.targetFoe ?? g.living[0], d = this.L(g.x, g.z);
      if (tg && g.phase !== 'won') { const f = this.L(tg.x, tg.z), s = side(d.x, d.z, f.x, f.z, tg.kind === 'bear' ? 4.4 : 3.6, 2.4, this.L(g.enzo.x, g.enzo.z)); tx = s.x; tz = s.z; ty = s.y; lx = s.lx; lz = s.lz; ly = 1.2; }
      else { this.orbit += dt * 0.3; tx = d.x + Math.sin(this.orbit) * 7; tz = d.z + Math.cos(this.orbit) * 7; ty = 2.6; lx = d.x; lz = d.z; }
      rate = 2.4;
    } else if (w && w.mode === 'talk') {
      // the speaker and Dora, from the side
      const who = w.talk?.who ? w.npcs().find((n) => n.id === w.talk!.who) : null;
      const d = DUELS.find((o) => o.before === w.talk?.scene || o.after === w.talk?.scene && o.area === w.area);
      const st = STONES.find((s) => s.scene === w.talk?.scene && s.area === w.area), sign = AREAS[w.area].signs.find((s) => s.scene === w.talk?.scene);
      const o = who ? { x: who.x, z: who.z } : d ? d.stand[0] : st ? { x: st.x, z: st.z } : sign ? { x: sign.x, z: sign.z } : { x: w.enzo.x, z: w.enzo.z };
      const s = side(dx, dz, o.x, o.z, 3.2, 1.9); tx = s.x; tz = s.z; ty = s.y; lx = s.lx; lz = s.lz; ly = 1.05; rate = 3;
    } else if (w && w.mode === 'end') {
      // the end: the camera drifts back so the Lamp and the two of them are both in view
      this.orbit += dt * 0.1; tx = dx + Math.sin(this.orbit) * 3; tz = dz + 7; ty = 2.2; lx = 0; lz = dz - 9; ly = 3.6; rate = 0.8;
    } else {
      // exploring: a follow camera on a tether behind Dora, turned by the player, easing round behind her as she walks
      if (w && w.moving) { const rel = wrap(w.face - this.yaw); if (Math.abs(rel) < 1.9) this.yaw += rel * Math.min(1, dt * 0.9); }
      this.yaw += this.turn * dt;
      const dist = phone ? 8.6 : 6.6, h = phone ? 4.2 : 3.2;
      tx = dx - Math.sin(this.yaw) * dist; tz = dz - Math.cos(this.yaw) * dist; ty = h; lx = dx + Math.sin(this.yaw) * 1.5; lz = dz + Math.cos(this.yaw) * 1.5; ly = 1.2; rate = 6;
    }
    if (!this.camInit) { this.camPos.set(tx, ty, tz); this.look.set(lx, ly, lz); this.camInit = true; }
    const k = 1 - Math.exp(-dt * rate);
    this.camPos.x += (tx - this.camPos.x) * k; this.camPos.y += (ty - this.camPos.y) * k; this.camPos.z += (tz - this.camPos.z) * k;
    this.look.x += (lx - this.look.x) * k; this.look.y += (ly - this.look.y) * k; this.look.z += (lz - this.look.z) * k;
    // the yaw the camera actually looks along (the cards face it, and the stick is read against it)
    if (fighting || w?.mode === 'talk' || w?.mode === 'end') this.yaw = Math.atan2(this.look.x - this.camPos.x, this.look.z - this.camPos.z);
    this.cam.position.copy(this.camPos);
    if (this.shake > 0) { this.cam.position.x += (Math.random() - 0.5) * this.shake; this.cam.position.y += (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 0.9); }
    this.cam.lookAt(this.look);
  }
}

// ---------------------------------------------------------------- which painting
const walkCycle = (base: string, dist: number, stride: number) => `${base}-${Math.floor(dist / stride) % 4}`;
function doraFightFrame(g: Fight, walked: number): string {
  const t = g.t;
  switch (g.state) {
    case 'run': return walkCycle('walk-side', walked, 0.5);
    case 'cut1': return t < CUTS[0].hit - 2 ? 'windup' : 'cut-a';
    case 'cut2': return 'cut-b';
    case 'cut3': return t < CUTS[2].hit - 3 ? 'windup' : 'lunge';
    case 'guard': return 'guard';
    case 'deflect': return 'deflect';
    case 'dodge': return t < 16 ? 'dodge' : 'stance';
    case 'hit': return 'hit';
    case 'recoil': return 'recoil';
    case 'broken': return 'stagger';
    case 'finisher': return t < FINISHER.hit - 2 ? 'fin-a' : 'fin-b';
    case 'tag': return t < 30 ? 'dash' : 'stance';
    case 'dead': return 'down';
    case 'win': return 'win';
    default: return 'stance';
  }
}
function foeFightFrame(f: Foe, walked: number, parry: boolean): string {
  if (parry && (f.state === 'stalk' || f.state === 'hit')) return 'parry';
  const bear = f.look === 'ukhu';
  const atk = (wind: boolean) => {
    const id = f.atk?.id ?? '';
    if (bear) return id === 'slam' ? (wind ? 'slam-wind' : 'slam') : id === 'thrust' ? (wind ? 'thrust-wind' : 'thrust') : (wind ? 'sweep-wind' : 'sweep');
    const second = id === 'lunge' || id === 'pounce';
    return second ? (wind ? 'a2-wind' : 'a2') : (wind ? 'a1-wind' : 'a1');
  };
  switch (f.state) {
    case 'enter': case 'stalk': {
      const n = bear ? 4 : 3, i = Math.floor(walked / (bear ? 0.55 : 0.45)) % (n + 1);
      // the walk cycle; standing still shows the guard stance
      return f.state === 'stalk' && (f.t % 40 < 3 || i === n) ? (i === n && bear ? 'walk-3' : 'idle') : `walk-${Math.min(i, n - 1)}`;
    }
    case 'windup': return atk(true);
    case 'strike': return atk(false);
    case 'recover': return f.t < 10 ? atk(false) : 'recover';
    case 'hit': return 'hit';
    case 'deflected': return 'deflected';
    case 'broken': return 'broken';
    case 'dead': return 'down';
  }
  return 'idle';
}

function arcGeo(r0: number, r1: number, len: number) {
  const n = 48, pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, a = k * len, w = Math.pow(Math.sin(PI * Math.min(1, k * 1.12)), 0.7), ri = mix(r1 - 0.02, r0, w), c = Math.pow(k, 1.7);
    pos.push(Math.cos(a) * ri, Math.sin(a) * ri, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0); col.push(c * 0.45, c * 0.45, c * 0.45, c, c, c);
    if (i < n) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g;
}
const addMat = (c: T.Color, vertexColors = false) => new T.MeshBasicMaterial({ vertexColors, color: c, transparent: true, opacity: 0, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false, fog: false });
export type { Look, Shape };
export { inShape };
