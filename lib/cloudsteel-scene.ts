// Cloudsteel: drawing only. Three.js on the WebGPU renderer (it falls back to WebGL 2 by itself): the three areas of
// the climb built from the story's data (lib/cloudsteel-story.ts), with Codex's painted figures stood up in them as
// cut-out cards. Each card turns to face the camera and picks its painting from what the figure is doing and which
// way it faces from the camera: front, back or side (the side painting mirrored for the other side) while exploring,
// and side-on paintings in a duel, where the camera swings round to watch from the side. Every action has its own
// painting: walk cycles, idles, talking, picking up, the lantern, guard, wind-ups, cuts, lunges, dodges, deflects,
// hits, staggers, finishers, falls and wins, and Enzo's sweep, ward and hop when he is the one fighting. While exploring,
// a painted chevron on the ground points the way to the next step of the story. Rules in lib/cloudsteel-game.ts and
// lib/cloudsteel-world.ts.
import * as T from 'three/webgpu';
import { pass, screenUV, smoothstep, float, vec2, reflector, mx_noise_float, positionWorld } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ARROW, CUTS, DASH, FINISHER, HOP, SWEEP, TAG, WARD, type Fight, type FightEvent, type Foe, type Look } from './cloudsteel-game';
import { duelToWorld, GoalGuide, inShape, LANTERN, nextGoal, PICKUP, type AreaId, type Goal, type Duel, type Prop, type Shape, type World, type WorldEvent, type Who } from './cloudsteel-world';
import { AREAS, DUELS, ITEMS, STONES } from './cloudsteel-story';
import { SPRITES, SPRITE_PPM, type SpriteSheet } from './cloudsteel-sprites';
import { DECOR, type DecorItem } from './cloudsteel-decor';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI, art = (n: string) => `/art/cloudsteel/${n}.webp`;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const wrap = (a: number) => { while (a > PI) a -= PI * 2; while (a < -PI) a += PI * 2; return a; };
const hdr = (r: number, g: number, b: number) => new T.Color().setRGB(r, g, b);
/** a lantern post's light: kept low, so the lamp warms the stone round it without a bright pool on the wall behind */
const LAMP = 10;
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

// ---------------------------------------------------------------- the painted stonework
// Geometry whose texture keeps one scale in the world (so a wall and a step show stones of the same size), and a batch
// that merges every static piece of an area into one mesh per material: a whole area draws in a handful of calls.
/** scales a geometry's uvs face by face: `dims(face)` gives the face's size in metres along u and v */
function scaleUV(g: T.BufferGeometry, perFace: number, dims: (face: number) => [number, number]) {
  const uv = g.attributes.uv as T.BufferAttribute;
  for (let i = 0; i < uv.count; i++) { const [su, sv] = dims(Math.floor(i / perFace)); uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }
  return g;
}
/** a box whose texture repeats every `tile` metres on every face */
function boxT(w: number, h: number, d: number, tile = 2) {
  const f: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  return scaleUV(new T.BoxGeometry(w, h, d), 4, (i) => [f[i][0] / tile, f[i][1] / tile]);
}
/** a band of the carved frieze wrapped round a box: the frieze keeps its own proportions along every side */
function bandT(w: number, h: number, d: number) {
  const f: [number, number][] = [[d / (h * 4), 1], [d / (h * 4), 1], [w / (h * 4), 0.1], [w / (h * 4), 0.1], [w / (h * 4), 1], [w / (h * 4), 1]];
  return scaleUV(new T.BoxGeometry(w, h, d), 4, (i) => f[i]);
}
/** a carved pillar: the painted pillar face on all four sides, stacked `v` times up its height */
function pillarGeo(w: number, h: number, d: number, v: number) { return scaleUV(new T.BoxGeometry(w, h, d), 4, (i) => (i === 2 || i === 3 ? [0.3, 0.3] : [1, v])); }
/** a door: the painted doors on the front and back, plain wood on the edges */
function doorGeo(w: number, h: number, d: number) { return scaleUV(new T.BoxGeometry(w, h, d), 4, (i) => (i < 4 ? [0.05, 0.05] : [1, 1])); }
/** ground in the world's own texture coordinates, so neighbouring pieces of floor line up */
function planeT(w: number, d: number, tile: number, cx: number, cz: number) {
  const g = new T.PlaneGeometry(w, d), p = g.attributes.position, uv = g.attributes.uv as T.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + cx) / tile, (p.getY(i) - cz) / tile);
  return g;
}
function discT(r: number, tile: number, cx: number, cz: number) {
  const g = new T.CircleGeometry(r, 48), p = g.attributes.position, uv = g.attributes.uv as T.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + cx) / tile, (p.getY(i) - cz) / tile);
  return g;
}
function cylT(r0: number, r1: number, h: number, tile: number) {
  const g = new T.CylinderGeometry(r0, r1, h, 24), c = PI * (r0 + r1);
  return scaleUV(g, 1, () => [c / tile, h / tile]);
}
/** a hipped roof over a w by d base, rising h to its ridge, its texture laid in rows along the eaves */
function hipRoof(w: number, d: number, h: number, tile: number) {
  const rx = Math.max(0, (w - d) / 2), rz = Math.max(0, (d - w) / 2), pos: number[] = [], uv: number[] = [];
  const sz = Math.hypot(h, d / 2 - rz), sx = Math.hypot(h, w / 2 - rx);
  const quad = (q: number[][], along: 0 | 2, slope: number) => {
    for (const i of [0, 1, 2, 0, 2, 3]) { const v = q[i]; pos.push(v[0], v[1], v[2]); uv.push(v[along] / tile, v[1] > 0 ? slope / tile : 0); }
  };
  quad([[-w / 2, 0, d / 2], [w / 2, 0, d / 2], [rx, h, rz], [-rx, h, rz]], 0, sz);
  quad([[w / 2, 0, -d / 2], [-w / 2, 0, -d / 2], [-rx, h, -rz], [rx, h, -rz]], 0, sz);
  quad([[w / 2, 0, d / 2], [w / 2, 0, -d / 2], [rx, h, -rz], [rx, h, rz]], 2, sx);
  quad([[-w / 2, 0, -d / 2], [-w / 2, 0, d / 2], [-rx, h, rz], [-rx, h, -rz]], 2, sx);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  return g;
}
/** a card of set dressing cut from the decor atlas, `h` tall, standing on its base or centred */
function decorGeo(it: DecorItem, h: number, stand: boolean) {
  const g = new T.PlaneGeometry(h * it.aspect, h), uv = g.attributes.uv as T.BufferAttribute;
  // PlaneGeometry's uv order: top-left, top-right, bottom-left, bottom-right
  uv.setXY(0, it.u0, it.v1); uv.setXY(1, it.u1, it.v1); uv.setXY(2, it.u0, it.v0); uv.setXY(3, it.u1, it.v0);
  if (stand) g.translate(0, h / 2, 0);
  return g;
}
/** how tall each piece of set dressing stands, in metres, and where a wall piece hangs (its middle) */
const DECOR_H: Record<string, number> = { banner: 3.6, brazier: 1.5, stele: 2.4, tapestry: 2.6, 'relief-puma': 1.6, offering: 0.95, ferns: 0.95, statue: 2.1, jars: 1.3, 'relief-condor': 1.7, column: 3, vines: 2.6, 'relief-serpent': 1.6, cargo: 1.2, lamp: 2.4, pennants: 3.8 };
const DECOR_Y: Record<string, number> = { tapestry: 3.3, 'relief-puma': 2.3, 'relief-condor': 2.4, 'relief-serpent': 2.3, vines: 4.2 };
class Batch {
  private parts = new Map<T.Material, T.BufferGeometry[]>(); private m = new T.Matrix4(); private q = new T.Quaternion(); private e = new T.Euler(); private p = new T.Vector3(); private s = new T.Vector3(1, 1, 1);
  add(geo: T.BufferGeometry, mat: T.Material, x: number, y: number, z: number, o: { rx?: number; ry?: number; rz?: number } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); geo.dispose();
    if (!g.attributes.normal) g.computeVertexNormals();
    this.m.compose(this.p.set(x, y, z), this.q.setFromEuler(this.e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0)), this.s); g.applyMatrix4(this.m);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    let l = this.parts.get(mat); if (!l) { l = []; this.parts.set(mat, l); } l.push(g);
  }
  build(into: T.Object3D) {
    for (const [mat, gs] of this.parts) { const merged = mergeGeometries(gs, false); if (merged) into.add(new T.Mesh(merged, mat)); for (const g of gs) g.dispose(); }
    this.parts.clear();
  }
}
type Kit = Record<'ashlar' | 'cliff' | 'thatch' | 'tile' | 'wood' | 'trim' | 'trimStone' | 'paving' | 'moss' | 'stone' | 'door' | 'doorDark' | 'pillar', T.MeshStandardMaterial> & { decor: T.MeshStandardMaterial };
/** the shared materials of the painted stonework: one each, reused by every area */
function makeKit(): Kit {
  const t = (n: string) => loadTex(n, 1);
  const roofs = { side: T.DoubleSide };
  const decor = new T.MeshStandardMaterial({ map: loadTex('decor'), alphaTest: 0.4, side: T.DoubleSide, roughness: 1, metalness: 0, emissive: 0xffffff, emissiveMap: loadTex('decor'), emissiveIntensity: 0.14 });
  decor.color.setScalar(0.78);
  const door = loadTex('door'), pillar = loadTex('pillar'); for (const x of [door, pillar]) { x.wrapS = x.wrapT = T.RepeatWrapping; }
  return {
    ashlar: std(0xc9d1dc, { map: t('ashlar'), roughness: 0.82 }), cliff: std(0x9aa6b4, { map: t('cliff'), roughness: 0.9 }),
    thatch: std(0xc9b89a, { map: t('thatch'), roughness: 0.95, ...roofs }), tile: std(0xc8dcdc, { map: t('roof'), roughness: 0.5, ...roofs }),
    wood: std(0xa89888, { map: t('wood'), roughness: 0.8 }), trim: std(0xdfe5ee, { map: t('trim'), roughness: 0.55, metalness: 0.1 }), trimStone: std(0xc9d1dc, { map: t('ashlar'), roughness: 0.7 }),
    paving: std(0xd4d4d8, { map: t('paving'), roughness: 0.7 }), moss: std(0xffffff, { map: t('moss'), roughness: 0.75 }), stone: std(0xffffff, { map: t('stone'), roughness: 0.75 }),
    door: std(0xb8a898, { map: door, roughness: 0.7 }), doorDark: std(0x55504c, { map: door, roughness: 0.8 }), pillar: std(0xc9d1dc, { map: pillar, roughness: 0.8 }), decor,
  };
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
type DecorSet = { name: string; items: { x: number; y: number; z: number; s: number }[]; mesh: T.InstancedMesh | null };
type AreaBuild = { group: T.Group; planks: Map<string, T.Mesh>; gates: Map<string, T.Object3D>; stones: Map<string, T.Mesh>; posts: T.Object3D[]; lamps: T.PointLight[]; decor: DecorSet[]; flames: T.Sprite[]; sunLamp?: T.Mesh; sunLight?: T.PointLight; sunHalo?: T.Sprite; seals: { mesh: T.Mesh; mat: T.MeshStandardMaterial }[] };
/** what to draw: the terrace duel from the title menu, or the story (with its duel, when one is on) */
export type View = { kind: 'arena'; fight: Fight } | { kind: 'story'; world: World; fight: Fight | null };
const ARENA_DUEL: Duel = { ...DUELS[0], id: 'arena' };

export class CloudsteelScene {
  private renderer: T.WebGPURenderer; private scene = new T.Scene(); private cam = new T.PerspectiveCamera(42, 16 / 9, 0.1, 700);
  private pipe: T.RenderPipeline | null = null; private fxOn: boolean; private sealTex!: T.Texture;
  private areas = new Map<AreaId, AreaBuild>(); private area: AreaId | null = null; private pano!: T.MeshBasicMaterial;
  private cards = new Map<string, Card>(); private blobMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false });
  private pickups = new Map<string, T.Object3D>(); private staffL!: T.PointLight; private lanternRing!: T.Mesh;
  private fx: Fx[] = []; private trails: T.Mesh[] = []; private trailBox = new T.Group(); private tagRing!: T.Mesh; private jadeRing!: T.Mesh; private glint!: T.Sprite; private mark!: T.Mesh; private finish!: T.Mesh;
  private sparks!: T.InstancedMesh; private sP: T.Vector3[] = []; private sV: T.Vector3[] = []; private sLife = new Float32Array(140); private sNext = 0; private dum = new T.Object3D(); private tmp = new T.Vector3();
  private rainPos!: Float32Array; private rainG!: T.BufferGeometry; private rain!: T.LineSegments; private mists: T.Sprite[] = [];
  private kit!: Kit; private softTex!: T.Texture; private inkTex!: T.Texture; private ghostMat!: T.MeshBasicMaterial; private plankMat!: T.MeshStandardMaterial;
  private now = 0; private shake = 0; private yaw = PI; private camPos = new T.Vector3(0, 4, 18); private look = new T.Vector3(0, 1.2, 0); private camInit = false;
  private duel: Duel = ARENA_DUEL; private walked = new Map<string, number>(); private lastPos = new Map<string, { x: number; z: number }>(); private parryT = new Map<number, number>();
  private talkT = 0; private lastLine: unknown = null; private coldT = 0; private orbit = 0; private step = new Map<string, number>();
  // the tag team: Enzo's sweep and ward, the archers' red lines and their arrows
  private sweepArc!: T.Mesh; private wardRing!: T.Mesh; private wardGlow!: T.Sprite; private wardHit = 0; private aims: T.Mesh[] = []; private aimEnds: T.Mesh[] = []; private arrows: T.Group[] = [];
  // the quest arrow: a chevron on the ground ahead of Dora, a medallion on the goal
  private guide = new GoalGuide(); private chev!: T.Mesh; private goalMark!: T.Mesh;
  /** show the quest arrow (the Settings toggle) */
  quest = true;
  /** where the goal is on screen, for the page's edge pointer: fractions of the width and height, and the angle (radians,
   *  0 to the right, counter-clockwise) the pointer should point; null when the goal is on screen or there is none */
  goalEdge: { x: number; y: number; ang: number } | null = null;
  /** the chevron or the goal's medallion is on the ground (for the browser tests) */
  get questShown() { return this.chev.visible || this.goalMark.visible; }
  /** the player turning the camera while exploring: radians a second */
  turn = 0;
  /** 'webgpu' or 'webgl2', for the settings screen */
  backend: 'webgpu' | 'webgl2' = 'webgl2';
  /** how much the scene draws: 'full' on a desktop, 'phone' on a small touch screen (a lower pixel ratio, lighter
   * antialiasing, a smaller reflection and fewer lamp lights), 'low' with Effects off (no bloom, no reflection) */
  readonly tier: 'full' | 'phone' | 'low';

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
    const phone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
    this.tier = !fx ? 'low' : phone ? 'phone' : 'full';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.tier === 'full' ? 2 : this.tier === 'phone' ? 1.5 : 1.25));
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    this.scene.fog = new T.FogExp2(0x12283a, 0.014);
    this.kit = makeKit(); this.buildSky(); this.buildEffects(); this.buildFigures();
    if (fx) {
      const scenePass = pass(this.scene, this.cam, { samples: phone ? 2 : 4 }), col = scenePass.getTextureNode();
      const vig = float(1).sub(smoothstep(0.35, 0.95, screenUV.sub(0.5).length()).mul(0.55));
      // bloom only on what is brighter than white (sparks, strokes, the far jade seal, the Sun Lamp), never the painted
      // faces; a small radius keeps it a tight halo round the bright thing instead of a soft blob across the screen
      this.pipe = new T.RenderPipeline(renderer); this.pipe.outputNode = col.add(bloom(col, 0.3, 0.1, 1.05)).mul(vig);
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
    // the jade seal's face: carved rings round a stepped cross, pale where the carving catches the light
    this.sealTex = canvasTex(256, 256, (g, w) => {
      const c = w / 2, r = g.createRadialGradient(c, c, 0, c, c, c); r.addColorStop(0, '#9fe8c8'); r.addColorStop(0.7, '#3f9c78'); r.addColorStop(1, '#1d5c47'); g.fillStyle = r; g.fillRect(0, 0, w, w);
      g.lineWidth = 7; for (const [k, col] of [[0.9, '#16493a'], [0.83, '#b8f2d8'], [0.62, '#16493a']] as const) { g.strokeStyle = col; g.beginPath(); g.arc(c, c, c * k, 0, PI * 2); g.stroke(); }
      g.fillStyle = 'rgba(22,73,58,.55)'; for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; g.beginPath(); g.arc(c + Math.cos(a) * c * 0.725, c + Math.sin(a) * c * 0.725, 7, 0, PI * 2); g.fill(); }
      g.fillStyle = '#e4fff3'; for (const [hw, hh] of [[16, 62], [62, 16], [40, 40]]) g.fillRect(c - hw, c - hh, hw * 2, hh * 2);
      g.fillStyle = '#2f8466'; g.fillRect(c - 12, c - 12, 24, 24);
    });
    this.inkTex = canvasTex(128, 128, (g, w) => { g.fillStyle = '#fff'; for (let i = 0; i < 26; i++) { const a = Math.random() * PI * 2, d = Math.pow(Math.random(), 0.7) * 46, r = 4 + Math.random() * (i < 6 ? 26 : 9); g.beginPath(); g.arc(w / 2 + Math.cos(a) * d, w / 2 + Math.sin(a) * d, r, 0, PI * 2); g.fill(); } });
    this.blobMat.map = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
    this.blobMat.alphaMap = this.blobMat.map; this.blobMat.map = null;
    // the moon: a crisp disc with a thin halo, only a touch brighter than white so the bloom stays at its rim
    const moonTex = canvasTex(256, 256, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(240,246,255,1)'); r.addColorStop(0.6, 'rgba(232,240,255,1)'); r.addColorStop(0.64, 'rgba(170,200,255,.22)'); r.addColorStop(0.8, 'rgba(120,170,255,.05)'); r.addColorStop(1, 'rgba(120,170,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); g.fillStyle = 'rgba(150,170,205,.35)'; [[104, 96, 22], [160, 136, 15], [122, 168, 12], [166, 88, 10]].forEach((c) => { g.beginPath(); g.arc(c[0], c[1], c[2], 0, PI * 2); g.fill(); }); });
    const moon = add(new T.Sprite(new T.SpriteMaterial({ map: moonTex, color: hdr(1.0, 1.08, 1.25), fog: false, transparent: true, depthWrite: false }))); moon.scale.set(20, 20, 1); moon.position.set(-30, 50, -140);
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
    const b: AreaBuild = { group: g, planks: new Map(), gates: new Map(), stones: new Map(), posts: [], lamps: [], decor: [], flames: [], seals: [] };
    const M = this.kit, B = new Batch();
    const ground = id === 'forest' ? M.moss : id === 'citadel' ? M.paving : M.stone, groundTile = id === 'citadel' ? 5 : 4;
    const gold = std(0xd9a441, { roughness: 0.35, metalness: 0.9 }), lampM = glowM(hdr(1.25, 0.64, 0.17));
    // the walkable ground, standing on cliffs that drop into the mist, with a carved kerb along every open edge
    A.walk.forEach((s, i) => {
      const y = -0.002 * i;
      if (s.k === 'rect') {
        const w = s.x1 - s.x0, d = s.z1 - s.z0, cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
        B.add(planeT(w, d, groundTile, cx, cz), ground, cx, y, cz, { rx: -PI / 2 });
        B.add(boxT(w, 26, d, 7), M.cliff, cx, y - 13.05, cz);
      } else {
        B.add(discT(s.r, groundTile, s.x, s.z), ground, s.x, y, s.z, { rx: -PI / 2 });
        B.add(cylT(s.r, s.r * 0.8, 26, 7), M.cliff, s.x, y - 13.05, s.z);
      }
    });
    this.kerbs(A, B);
    const post = (x: number, z: number, light: boolean) => {
      const p = new T.Group(); p.position.set(x, 0, z); g.add(p); b.posts.push(p);
      mesh(boxT(0.24, 3.1, 0.24, 1.2), M.wood, 0, 1.55, 0, p); mesh(boxT(0.2, 0.16, 1.1, 1.2), M.wood, 0, 2.95, 0.4, p); mesh(hipRoof(1.3, 0.6, 0.3, 1.5), M.thatch, 0, 3.08, 0, p);
      mesh(box(0.02, 0.45, 0.02), M.wood, 0, 2.65, 0.8, p); const l = mesh(box(0.34, 0.46, 0.34), lampM, 0, 2.25, 0.8, p); mesh(box(0.42, 0.06, 0.42), M.wood, 0, 2.5, 0.8, p); mesh(box(0.42, 0.06, 0.42), M.wood, 0, 2.0, 0.8, p);
      // a small halo that hugs the lantern, not a soft blob round the whole post
      const s = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: 0xffc45e, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false })); s.scale.set(1.05, 1.15, 1); s.position.copy(l.position); p.add(s);
      // the lamps sit high and well away from where figures stand, so a face next to one does not blow out
      if (light) { const pl = new T.PointLight(0xffb44d, LAMP, 11, 2); pl.position.set(0, 2.6, 0.8); p.add(pl); b.lamps.push(pl); }
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
    /** a building: a carved plinth, masonry walls with a frieze under the eaves, and a hipped roof that overhangs */
    const house = (x: number, y: number, z: number, w: number, d: number, h: number, roofH: number, roof: T.Material, ry = 0, eave = 0.7) => {
      const o = { ry }, at = (lx: number, ly: number, lz: number) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), y + ly, z - lx * Math.sin(ry) + lz * Math.cos(ry)] as const;
      B.add(boxT(w + 0.7, 0.4, d + 0.7, 2), M.ashlar, ...at(0, 0.2, 0), o);
      B.add(bandT(w + 0.74, 0.16, d + 0.74), M.trim, ...at(0, 0.36, 0), o);
      B.add(boxT(w, h, d, 2.2), M.ashlar, ...at(0, 0.4 + h / 2, 0), o);
      B.add(bandT(w + 0.08, 0.42, d + 0.08), M.trim, ...at(0, 0.4 + h - 0.21, 0), o);
      B.add(boxT(w + eave * 2, 0.16, d + eave * 2, 1.4), M.wood, ...at(0, 0.48 + h, 0), o);
      B.add(hipRoof(w + eave * 2, d + eave * 2, roofH, 2), roof, ...at(0, 0.56 + h, 0), o);
      return 0.56 + h + roofH;
    };
    for (const p of A.props) {
      if (p.kind.startsWith('d:') || p.kind.startsWith('w:')) { this.decorProp(p, A, B, b); continue; }
      switch (p.kind) {
        // every other post casts light (every third on a phone: each light costs every pixel it might reach)
        case 'post': post(p.x, p.z, nLamp++ % (this.tier === 'phone' ? 3 : 2) === 0); break;
        case 'tree': foliage(1, p.x, p.z, p.s ?? 1); break;
        case 'fern': foliage(0, p.x, p.z, p.s ?? 1); break;
        case 'bush': foliage(2, p.x, p.z, p.s ?? 1); break;
        case 'bamboo': foliage(3, p.x, p.z, p.s ?? 1); break;
        case 'grove': { // a mossy rock pillar out of the mist with a tree, a fern or bamboo on top
          const r = 1.3 * (p.s ?? 1), cell = [1, 0, 3, 1, 0][Math.abs(Math.round(p.x * 3 + p.z * 5)) % 5];
          B.add(discT(r, 4, p.x, p.z), M.moss, p.x, -0.12, p.z, { rx: -PI / 2 });
          B.add(cylT(r, r * 0.7, 26, 7), M.cliff, p.x, -13.13, p.z);
          foliage(cell, p.x, p.z, (p.s ?? 1) * (cell === 1 ? 1.15 : 1)); break;
        }
        case 'arena': this.buildArena(g, B, p.x, p.z, id); break;
        case 'temple': {
          // the hanging temple across the gorge: a terraced platform, three tiers under tiled roofs, lit windows
          const x = p.x, z = p.z;
          B.add(boxT(17, 2.6, 10, 2.4), M.ashlar, x, 1.1, z); B.add(bandT(17.06, 0.5, 10.06), M.trim, x, 2.15, z);
          for (let i = 0; i < 5; i++) B.add(boxT(6, 0.5, 0.7, 2), M.ashlar, x, 0.25 + i * 0.5, z + 5.35 + (4 - i) * 0.7);
          const y1 = house(x, 2.4, z, 10.5, 5.4, 3.2, 1.8, M.tile, 0, 1.1);
          house(x, 2.4 + y1 - 0.9, z, 6.4, 3.6, 2.0, 1.5, M.tile, 0, 0.9);
          house(x, 2.4 + y1 - 0.9 + 3.6, z, 3.2, 2.2, 1.4, 1.3, M.tile, 0, 0.7);
          [-3.4, 0, 3.4].forEach((lx) => mesh(box(1.3, 2.0, 0.1), lampM, x + lx, 3.9, z + 2.72, g));
          B.add(cylT(5, 8, 40, 7), M.cliff, x, -20, z);
          break;
        }
        case 'bellhouse': {
          const h = new T.Group(); h.position.set(p.x, 0, p.z); g.add(h);
          house(p.x, 0, p.z, 2.8, 6, 2.2, 1.5, M.thatch, 0, 0.8);
          const bell = mesh(new T.CylinderGeometry(0.25, 0.45, 0.7, 16), std(0x6f8f6a, { metalness: 0.7, roughness: 0.4 }), 1.7, 2.1, 3.6, h); bell.userData.bell = true;
          mesh(boxT(0.16, 2.8, 0.16, 1.2), M.wood, 1.7, 1.4, 4.3, h); mesh(boxT(0.16, 2.8, 0.16, 1.2), M.wood, 1.7, 1.4, 2.9, h); mesh(boxT(0.16, 0.16, 1.7, 1.2), M.wood, 1.7, 2.75, 3.6, h);
          mesh(hipRoof(1.1, 2.2, 0.45, 1.5), M.thatch, 1.7, 2.82, 3.6, h);
          break;
        }
        case 'stairs': for (let i = 0; i < 8; i++) { B.add(boxT(5.2, 0.18, 1.2, 2), M.ashlar, p.x, -0.06 + 0.001 * i, p.z + 3.5 - i * 1.25); B.add(bandT(5.22, 0.1, 0.1), M.trim, p.x, -0.02 + 0.001 * i, p.z + 3.5 - i * 1.25 + 0.6); } break;
        case 'gate': case 'jadegate': case 'jadedoor': {
          const gid = A.gates.find((o) => Math.abs((o.shape.k === 'rect' ? (o.shape.x0 + o.shape.x1) / 2 : 0) - p.x) < 1.6 && Math.abs((o.shape.k === 'rect' ? (o.shape.z0 + o.shape.z1) / 2 : 0) - p.z) < 1.6)?.id;
          const side = p.kind === 'jadedoor', w = side ? 4 : 5.6, gr = new T.Group(); gr.position.set(p.x, 0, p.z); if (side) gr.rotation.y = PI / 2; g.add(gr);
          // carved pillars, a lintel with its frieze and a little stepped crest
          for (const s of [-1, 1]) { mesh(pillarGeo(1.5, 4.8, 1.7, 2), M.pillar, s * (w / 2 + 0.75), 2.4, 0, gr); mesh(boxT(1.9, 0.4, 2.1, 2), M.ashlar, s * (w / 2 + 0.75), 0.2, 0, gr); }
          mesh(boxT(w + 3.2, 1.1, 2.0, 2), M.ashlar, 0, 5.35, 0, gr); mesh(bandT(w + 3.24, 0.5, 2.04), M.trim, 0, 5.35, 0, gr);
          mesh(boxT(w + 3.6, 0.2, 2.3, 2), M.ashlar, 0, 6.0, 0, gr);
          for (const [sw, sy] of [[3, 6.3], [1.8, 6.6]] as const) mesh(boxT(sw, 0.3, 1.2, 2), M.ashlar, 0, sy, 0, gr);
          mesh(new T.ConeGeometry(0.35, 0.8, 4), gold, 0, 7.15, 0, gr).rotation.y = PI / 4;
          const door = new T.Group(); gr.add(door);
          mesh(doorGeo(w, 4.4, 0.4), M.door, 0, 2.2, 0, door);
          // the jade seal: carved jade lit by the scene, whose glow comes up with distance (see render), so it reads as
          // magic from across the yard without flooding the screen when Dora stands at the door
          if (p.kind !== 'gate') for (const sd of [1, -1]) {
            const mat = new T.MeshStandardMaterial({ map: this.sealTex, emissive: hdr(0.25, 1, 0.7), emissiveMap: this.sealTex, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.1 });
            const seal = mesh(new T.CircleGeometry(0.75, 40), mat, 0, 2.4, 0.23 * sd, door); if (sd < 0) seal.rotation.y = PI; b.seals.push({ mesh: seal, mat });
          }
          if (gid) b.gates.set(gid, door);
          break;
        }
        case 'condorgate': {
          // the Condor Gate: two carved pillars, a lintel, the great stone condor with the Sun Lamp on its breast
          const cg = new T.Group(); cg.position.set(p.x, 0, p.z); g.add(cg);
          for (const s of [-1, 1]) {
            mesh(pillarGeo(2.6, 9, 2.6, 3), M.pillar, s * 4.6, 4.5, 0, cg); mesh(boxT(3.4, 0.6, 3.4, 2), M.ashlar, s * 4.6, 0.3, 0, cg); mesh(bandT(3.44, 0.22, 3.44), M.trim, s * 4.6, 0.62, 0, cg);
            mesh(boxT(3.0, 0.5, 3.0, 2), M.ashlar, s * 4.6, 9.25, 0, cg);
          }
          mesh(boxT(12.6, 1.9, 2.8, 2.2), M.ashlar, 0, 9.95, 0, cg); mesh(bandT(12.64, 0.7, 2.84), M.trim, 0, 9.95, 0, cg);
          mesh(boxT(13.2, 0.3, 3.1, 2), M.ashlar, 0, 11.05, 0, cg);
          const condor = mesh(new T.PlaneGeometry(11, 11 * 852 / 1536), new T.MeshStandardMaterial({ map: loadTex('condor-relief'), transparent: true, alphaTest: 0.3, side: T.DoubleSide, roughness: 0.8, emissive: 0xffffff, emissiveMap: loadTex('condor-relief'), emissiveIntensity: 0.12 }), 0, 11.2 + 11 * 852 / 1536 / 2 - 0.4, 0.35, cg);
          (condor.material as T.MeshStandardMaterial).color.setScalar(0.85);
          const lampMat = new T.MeshBasicMaterial({ map: loadTex('sun-lamp'), transparent: true, alphaTest: 0.3, color: hdr(0.32, 0.3, 0.28), fog: false });
          b.sunLamp = mesh(new T.PlaneGeometry(3.4, 3.4), lampMat, 0, 13.2, 0.75, cg);
          const halo = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: hdr(1.6, 1.0, 0.35), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })); halo.scale.set(9, 9, 1); halo.position.set(0, 13.2, 0.6); cg.add(halo); b.sunHalo = halo;
          b.sunLight = new T.PointLight(0xffc060, 0, 60, 1.6); b.sunLight.position.set(0, 12, 7); cg.add(b.sunLight);
          mesh(doorGeo(6.6, 7.6, 0.5), M.door, 0, 3.8, 0.2, cg).material = M.doorDark;
          B.add(cylT(30, 18, 40, 9), M.cliff, p.x, -20.5, p.z - 6);
          break;
        }
        case 'walls': {
          // the citadel's fitted stone walls: a frieze along the top of both faces, a coping, towers with thatched roofs
          const wall = (x0: number, z0: number, x1: number, z1: number, h = 6) => {
            const l = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ry = -Math.atan2(z1 - z0, x1 - x0);
            B.add(boxT(l, h, 1.2, 2.2), M.ashlar, cx, h / 2 - 0.2, cz, { ry });
            B.add(bandT(l, 0.55, 1.26), M.trim, cx, h - 0.75, cz, { ry });
            B.add(boxT(l, 0.3, 1.5, 2), M.ashlar, cx, h - 0.05, cz, { ry });
            B.add(boxT(l, 0.5, 1.6, 2), M.ashlar, cx, 0.05, cz, { ry });
          };
          wall(-14, -5.4, -3.6, -5.4); wall(3.6, -5.4, 14, -5.4); wall(-14, -24.8, -3.2, -24.8, 7); wall(3.2, -24.8, 14, -24.8, 7);
          wall(-13.8, -24.8, -13.8, -17.6); wall(-13.8, -12.4, -13.8, -5.4); wall(13.8, -24.8, 13.8, -12.6); wall(13.8, -8.4, 13.8, -5.4);
          for (const [x, z] of [[-14, -5.4], [14, -5.4], [-14, -24.8], [14, -24.8]]) house(x, 0, z, 2.6, 2.6, 8.2, 2.2, M.thatch, 0, 0.6);
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
          for (const s of [-1, 1]) { const x = p.x + (horiz ? 0 : s * 1.5), z = p.z + (horiz ? s * 1.5 : 0); B.add(boxT(0.24, 1.5, 0.24, 1.2), M.wood, x, 0.75, z); B.add(boxT(0.5, 0.3, 0.5, 1), M.ashlar, x, 0.15, z); }
          break;
        }
        case 'shrine': { house(p.x, 0, p.z, 2.4, 2.4, 1.8, 1.3, M.thatch, 0, 0.5); mesh(box(0.8, 1.1, 0.1), lampM, p.x, 1.1, p.z + 1.22, g); break; }
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
      mesh(boxT(1.7, 0.35, 1.3, 2), M.ashlar, 0, 0.175, 0, st); mesh(boxT(1.3, 2.4, 0.9, 1.6), M.ashlar, 0, 1.4, 0, st); mesh(bandT(1.36, 0.3, 0.96), M.trim, 0, 2.45, 0, st);
      const face = mesh(new T.PlaneGeometry(1.15, 1.15), new T.MeshStandardMaterial({ map: t, emissive: hdr(1.6, 1.1, 0.35), emissiveMap: t, emissiveIntensity: 0, roughness: 0.7 }), 0, 1.55, 0.46, st);
      b.stones.set(s.id, face);
    }
    B.build(g);
    // the standing set dressing: one instanced card per kind, turned to the camera each frame
    for (const set of b.decor) {
      const m = new T.InstancedMesh(decorGeo(DECOR[set.name], DECOR_H[set.name] ?? 1.5, true), this.kit.decor, set.items.length);
      m.frustumCulled = false; g.add(m); set.mesh = m;
    }
    return b;
  }
  /** a carved kerb along every edge of the walkable ground that drops into the mist (not across exits or bridges) */
  private kerbs(A: (typeof AREAS)[AreaId], B: Batch) {
    const open = (x: number, z: number) => !A.walk.some((s) => inShape(s, x, z, 0)) && !A.exits.some((e) => inShape(e.shape, x, z, 0.8))
      && !A.planks.some((p) => Math.abs(x - p.x) < p.hx + 0.6 && Math.abs(z - p.z) < p.hz + 0.6);
    const run = (pts: { x: number; z: number; nx: number; nz: number }[], step: number) => {
      for (const p of pts) {
        if (!open(p.x + p.nx * 0.3, p.z + p.nz * 0.3)) continue;
        B.add(boxT(step + 0.04, 0.34, 0.36, 2), this.kit.ashlar, p.x + p.nx * 0.18, 0.07, p.z + p.nz * 0.18, { ry: Math.atan2(p.nx, p.nz) });
      }
    };
    for (const s of A.walk) {
      if (s.k === 'rect') {
        const step = 0.5, pts: { x: number; z: number; nx: number; nz: number }[] = [];
        for (let x = s.x0 + step / 2; x < s.x1; x += step) { pts.push({ x, z: s.z0, nx: 0, nz: -1 }, { x, z: s.z1, nx: 0, nz: 1 }); }
        for (let z = s.z0 + step / 2; z < s.z1; z += step) { pts.push({ x: s.x0, z, nx: -1, nz: 0 }, { x: s.x1, z, nx: 1, nz: 0 }); }
        run(pts, step);
      } else {
        const n = Math.ceil((s.r * PI * 2) / 0.5), step = (s.r * PI * 2) / n, pts: { x: number; z: number; nx: number; nz: number }[] = [];
        for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2, nx = Math.sin(a), nz = Math.cos(a); pts.push({ x: s.x + nx * s.r, z: s.z + nz * s.r, nx, nz }); }
        run(pts, step);
      }
    }
  }
  /** a piece of painted set dressing from the story's props: `d:` stands on the ground (on a carved plinth if it is
   * off the path) and turns to the camera like the figures; `w:` hangs on a wall facing `r` */
  private decorProp(p: Prop, A: (typeof AREAS)[AreaId], B: Batch, b: AreaBuild) {
    const name = p.kind.slice(2);
    if (name === 'mural') { // the painted fresco of the three worlds on the courtyard wall
      const m = mesh(new T.PlaneGeometry(4.8, 2.4), std(0xd8d2c8, { map: loadTex('mural'), roughness: 0.9 }), p.x, 2.7, p.z, b.group); m.rotation.y = p.r ?? 0;
      B.add(bandT(5.2, 0.22, 0.12), this.kit.trim, p.x, 1.4, p.z); B.add(bandT(5.2, 0.22, 0.12), this.kit.trim, p.x, 4.0, p.z); return;
    }
    const item = DECOR[name]; if (!item) return;
    const s = p.s ?? 1, h = (DECOR_H[name] ?? 1.5) * s;
    if (p.kind.startsWith('w:')) {
      const geo = decorGeo(item, h, false), m = mesh(geo, this.kit.decor, p.x, (DECOR_Y[name] ?? 2.4) * s, p.z, b.group); m.rotation.y = p.r ?? 0;
      return;
    }
    let y = 0;
    if (!A.walk.some((w) => inShape(w, p.x, p.z, 0.1))) {
      // off the path: a carved plinth rising out of the mist
      const pw = Math.max(1.1, h * item.aspect * 0.8);
      B.add(boxT(pw, 26, pw, 2.2), this.kit.ashlar, p.x, 0.25 - 13, p.z); B.add(bandT(pw + 0.04, 0.2, pw + 0.04), this.kit.trim, p.x, 0.15, p.z);
      y = 0.25;
    }
    let set = b.decor.find((d) => d.name === name);
    if (!set) { set = { name, items: [], mesh: null }; b.decor.push(set); }
    set.items.push({ x: p.x, y, z: p.z, s });
    if (name === 'brazier') {
      // a warm glow over the coals, kept below white so it never blooms over a face
      const f = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: 0xffa64a, transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false }));
      f.position.set(p.x, y + h * 0.95, p.z); f.scale.setScalar(0.8 * s); b.group.add(f); b.flames.push(f);
    }
  }
  /** the round paved floor with the wet reflection, where the duels on the terrace and at the gate are fought */
  private buildArena(g: T.Group, B: Batch, x: number, z: number, id: AreaId) {
    const R = 9.0;
    const floorMat = new T.MeshStandardNodeMaterial({ map: loadTex('floor'), roughness: 0.32, metalness: 0.15 });
    if (this.fxOn && id === 'terrace') {
      const refl = reflector({ resolutionScale: this.tier === 'phone' ? 0.35 : 0.5, samples: this.tier === 'phone' ? 0 : 4 }); refl.target.rotateX(-PI / 2); refl.target.position.set(x, 0.008, z); g.add(refl.target);
      const wp = positionWorld.mul(1.9); refl.uvNode = refl.uvNode!.add(vec2(mx_noise_float(wp), mx_noise_float(wp.add(11.3))).mul(0.0035));
      floorMat.emissiveNode = refl.rgb.mul(0.3);
    }
    const floor = mesh(new T.CircleGeometry(R, 64), floorMat, x, 0.008, z, g); floor.rotation.x = -PI / 2;
    B.add(new T.TorusGeometry(R + 0.05, 0.16, 8, 64), this.kit.trimStone, x, 0.1, z, { rx: PI / 2 });
  }
  // ---------------------------------------------------------------- the figures
  private buildFigures() {
    // Enzo's lantern: a warm light that follows the top of his staff. No glow sprite: it would sit on his centre line, not
    // on the painted lantern at his side, and float as a blob over Dora's head; the painted lantern reads as lit
    this.staffL = new T.PointLight(0xffc45e, 10, 9, 2); this.scene.add(this.staffL);
    this.lanternRing = mesh(new T.RingGeometry(0.92, 1, 64), new T.MeshBasicMaterial({ color: hdr(1.6, 1.2, 0.5), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }), 0, 0.05, 0, this.scene);
    this.lanternRing.rotation.x = -PI / 2;
    // the quest arrow, painted: a chevron that lies on the ground, and a medallion over the goal
    const flat = (n: string, w: number, h: number) => {
      const t = loadTex(n), g = new T.PlaneGeometry(w, h); g.rotateX(-PI / 2);
      const m = mesh(g, new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, color: hdr(1.15, 1.05, 0.9) }), 0, 0.05, 0, this.scene); m.renderOrder = 1; m.visible = false; return m;
    };
    this.chev = flat('quest-chevron', 0.82, 0.6); this.goalMark = flat('quest-mark', 1.3, 1.3);
  }
  private card(key: string, who: string) {
    let c = this.cards.get(key);
    if (!c) { c = new Card(who, loadTex(`sprites/${who}`), this.blobMat); this.scene.add(c.o); this.cards.set(key, c); }
    c.o.visible = true; return c;
  }
  /** how far a figure has walked, for its walk cycle */
  private stride(key: string, x: number, z: number) {
    const l = this.lastPos.get(key); let d = this.walked.get(key) ?? 0;
    let st = 0; if (l) { const s = Math.hypot(x - l.x, z - l.z); if (s < 2) { d += s; st = s; } }
    this.lastPos.set(key, { x, z }); this.walked.set(key, d); this.step.set(key, st); return d;
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
    // Enzo's sweep: a wide, low arc of lantern light; his ward: a ring of light round him and a soft dome
    this.sweepArc = new T.Mesh(arcGeo(1.4, 2.7, 3.0), addMat(hdr(2.2, 1.5, 0.45), true)); this.sweepArc.frustumCulled = false; this.sweepArc.visible = false; sc.add(this.sweepArc);
    this.wardRing = mesh(new T.RingGeometry(0.9, 1, 64), addMat(hdr(2.4, 1.8, 0.7)), 0, 0.07, 0, sc); this.wardRing.rotation.x = -PI / 2; this.wardRing.visible = false;
    this.wardGlow = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: hdr(1.2, 0.9, 0.4), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })); sc.add(this.wardGlow);
    // an archer's tell: a red line along the ground to where the arrow will go, and a red ring where it ends
    for (let i = 0; i < 3; i++) {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2); g.translate(0, 0, 0.5);
      const l = mesh(g, addMat(hdr(2.2, 0.18, 0.12)), 0, 0.06, 0, sc); l.visible = false; this.aims.push(l);
      const r = mesh(new T.RingGeometry(0.78, 1, 40), addMat(hdr(2.2, 0.2, 0.14)), 0, 0.065, 0, sc); r.rotation.x = -PI / 2; r.visible = false; this.aimEnds.push(r);
    }
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
      case 'hurt': { const p = e.who === 'enzo' ? at(g.enzo.x, g.enzo.z) : at(g.x, g.z); this.puff(p.x, 1.0, p.z, 1.7, e.jade ? hdr(0.4, 1.6, 1.0) : hdr(1.6, 0.6, 0.3), false, 0.3); this.puff(p.x, 0.9, p.z, 1.1, 0x0c1238, true, 0.4); kick(0.28); break; }
      case 'finisherHit': { const p = at(e.x, e.z); this.puff(p.x, 1.1, p.z, 4, hdr(2, 1.4, 0.5), false, 0.5); this.puff(p.x, 1.1, p.z, 2.4, 0x0c1238, true, 0.6); this.burst(p.x, 1.1, p.z, 50, 6.5); kick(0.32); break; }
      case 'tagHit': { const p = at(e.x, e.z); this.tagRing.position.set(p.x, 0.2, p.z); this.tagRing.userData.life = 1; this.puff(p.x, 1.2, p.z, 4.5, hdr(2, 1.5, 0.6), false, 0.5); this.burst(p.x, 1.0, p.z, 50, 6); kick(0.3); break; }
      case 'broken': { const f = g.foe(e.id); if (f) { const p = at(f.x, f.z); this.puff(p.x, 1.2, p.z, 3, hdr(1.8, 1.3, 0.5), false, 0.45); this.burst(p.x, 1.2, p.z, 24, 5); } kick(0.2); break; }
      case 'dead': { const f = g.foe(e.id); if (f) { const p = at(f.x, f.z); this.puff(p.x, 0.8, p.z, 2.6, 0x0c1238, true, 0.9); } break; }
      case 'warded': { const p = at(e.x, e.z); this.wardHit = 0.35; this.puff(p.x, 1.1, p.z, 2.2, hdr(2, 1.5, 0.6), false, 0.35); this.burst(p.x, 1.1, p.z, 18, 3.5); kick(0.08); break; }
      case 'arrowHit': { const p = at(e.x, e.z); this.burst(p.x, 1.0, p.z, 8, 2.5); break; }
      case 'sweepHit': { if (e.n > 0) { const p = at(e.x, e.z); this.burst(p.x, 0.9, p.z, 10 + e.n * 6, 3.5); kick(0.06 + e.n * 0.03); } break; }
      case 'swap': { const m = e.to === 'enzo' ? g.enzo : g, p = at(m.x, m.z); this.puff(p.x, 1.0, p.z, 1.8, hdr(1.4, 1.2, 0.6), false, 0.35); break; }
      case 'guardBroken': { const p = at(g.x, g.z); this.puff(p.x, 1.1, p.z, 2.2, hdr(0.9, 1, 1.4), false, 0.4); kick(0.22); break; }
    }
  }
  /** the world's events: the lantern, waking planks and stones, gates, pickups */
  worldEvent(e: WorldEvent, w: World) {
    const b = this.areas.get(w.area);
    switch (e.t) {
      case 'lantern': this.lanternRing.position.set(e.x, 0.05, e.z); this.lanternRing.userData.life = 1; this.lanternRing.userData.r = e.r; this.puff(w.enzo.x, 2.2, w.enzo.z, 2, hdr(2, 1.5, 0.6), false, 0.6); break;
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
      const e = this.L(g.enzo.x, g.enzo.z); ex = e.x; ez = e.z;
      // the one waiting fades should they come close to the lens, rather than fill the screen
      const fade = (x: number, z: number) => Math.min(1, Math.max(0.15, (Math.hypot(x - this.camPos.x, z - this.camPos.z) - 1.3) / 1.2));
      const dWalk = this.stride('dora', dx, dz), eWalk = this.stride('enzo', ex, ez), near = threatNear(g);
      const dc = this.card('dora', 'dora'), fWorld = g.face + this.duel.rot;
      dc.set(doraFightFrame(g, dWalk, (this.step.get('dora') ?? 0) > 0.004), Card.mirrorFor(fWorld, yaw));
      dc.y = g.state === 'finisher' && g.t < FINISHER.hit ? Math.sin((g.t / FINISHER.hit) * PI) * 1.1 : g.state === 'tagin' && g.t < DASH.hit ? Math.sin((g.t / DASH.hit) * PI) * 0.35 : 0;
      dc.spin = g.state === 'dodge' && g.t < 14 ? (Card.mirrorFor(fWorld, yaw) ? 1 : -1) * (g.t / 14) * PI * 2 : 0;
      dc.alpha = g.hero === 'dora' ? 1 : fade(dx, dz); dc.bob = 0; dc.update(dx, dz, yaw);
      const ec = this.card('enzo', 'enzo'), en = g.enzo, eFace = en.face + this.duel.rot;
      const ef = enzoFightFrame(g, eWalk, (this.step.get('enzo') ?? 0) > 0.004, near, this.wardHit > 0);
      const ey = en.state === 'leap' ? Math.sin(Math.min(1, en.t / 22) * PI) * 1.3 : en.state === 'hop' ? Math.sin(Math.min(1, en.t / HOP.len) * PI) * 0.5 : 0;
      ec.set(ef, Card.mirrorFor(eFace, yaw)); ec.y = ey; ec.spin = 0; ec.alpha = g.hero === 'enzo' ? 1 : fade(ex, ez); ec.bob = 0; ec.update(ex, ez, yaw);
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
      else if (w.mode === 'end') { df = 'gaze'; }
      else if (w.moving) df = walkCycle(`walk-${vw}`, dWalk, 0.4);
      else df = `idle-${vw}`;
      dc.bob = w.moving || w.mode === 'talk' ? 0 : Math.sin(now * 2.2) * 0.008;
      dc.set(df, dm); dc.update(dx, dz, yaw);
      const ec = this.card('enzo', 'enzo'); ec.y = 0; ec.spin = 0; ec.alpha = 1;
      const evw = view(w.enzo.face, yaw), eWalk = this.stride('enzo', ex, ez);
      let ef: string;
      if (w.mode === 'lantern') ef = this.coldT > 0 && w.t > LANTERN.at ? 'lantern-sweep' : 'lantern-up';
      else if (w.mode === 'talk') ef = talkFrame('enzo', talkLine?.mood ? 'talk-b' : 'talk-a', talkLine?.mood ? 'talk-a' : 'talk-b') ?? 'idle-side';
      else if (w.mode === 'end') ef = 'offer';
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
        const m = b.sunLamp.material as T.MeshBasicMaterial; m.color.lerp(hdr(1.6, 1.25, 0.8), Math.min(1, dt * 0.8));
        if (b.sunHalo) { const hm = b.sunHalo.material as T.SpriteMaterial; hm.opacity = Math.min(0.4, hm.opacity + dt * 0.2); }
        if (b.sunLight) b.sunLight.intensity = Math.min(140, b.sunLight.intensity + dt * 60);
      }
      this.hideFightFx(dt);
    }
    this.questArrow(w, now);
    // Enzo's lantern light sits at the top of his staff
    const lanternUp = w?.mode === 'lantern' ? w.enzo.lantern : 0;
    this.staffL.position.set(ex, 2.3 + lanternUp * 0.6, ez); this.staffL.intensity = 8 + lanternUp * 30;
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
          const glow = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: it.kind === 'quipu' ? 0xffd27a : 0x9ff0d0, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false })); glow.scale.set(1.1, 1.1, 1); glow.position.y = 0.7; o.add(glow);
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
    b.lamps.forEach((l, i) => { l.intensity = LAMP + Math.sin(now * 5 + i * 2) * 0.8; });
    // the jade seals: soft up close, brighter (just past white, so a small halo) from across the yard, with a slow pulse
    for (const sl of b.seals) { const d = sl.mesh.getWorldPosition(this.tmp).distanceTo(this.cam.position); sl.mat.emissiveIntensity = (0.45 + 0.85 * Math.min(1, Math.max(0, (d - 4) / 10))) * (1 + Math.sin(now * 2) * 0.08); }
    this.camera(v, dt, dx, dz);
    // nothing tall right in front of the lens
    for (const post of b.posts) post.visible = Math.hypot(post.position.x - this.camPos.x, post.position.z - this.camPos.z) > 3.6;
    for (const set of b.decor) {
      if (!set.mesh) continue;
      set.items.forEach((it, i) => {
        const near = Math.hypot(it.x - this.camPos.x, it.z - this.camPos.z) < 3.2;
        this.dum.position.set(it.x, it.y, it.z); this.dum.rotation.set(0, this.yaw + PI, 0); this.dum.scale.setScalar(near ? 0 : it.s); this.dum.updateMatrix(); set.mesh!.setMatrixAt(i, this.dum.matrix);
      });
      set.mesh.instanceMatrix.needsUpdate = true;
    }
    b.flames.forEach((f, i) => { (f.material as T.SpriteMaterial).opacity = 0.28 + Math.sin(now * 9 + i * 1.7) * 0.05 + Math.sin(now * 23 + i) * 0.03; });
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
    // Enzo's sweep and ward
    const en = g.enzo, ep = this.L(en.x, en.z), sw = en.state === 'sweep' && en.t >= SWEEP.hit - 4 && en.t <= SWEEP.hit + 10;
    this.sweepArc.visible = sw;
    if (sw) { const k = (en.t - (SWEEP.hit - 4)) / 14; this.sweepArc.position.set(ep.x, 0.75, ep.z); this.sweepArc.rotation.set(PI / 2, 0, -(en.face + this.duel.rot) + PI / 2 - SWEEP.arc - 0.2 + k * 0.4); (this.sweepArc.material as T.MeshBasicMaterial).opacity = Math.sin(k * PI) * 0.9; }
    const ward = en.state === 'ward' ? Math.min(1, en.t / 5) * Math.min(1, (WARD.len - en.t) / 8) : 0, wg = this.wardGlow.material as T.SpriteMaterial;
    this.wardHit = Math.max(0, this.wardHit - dt);
    this.wardRing.visible = ward > 0; this.wardRing.position.set(ep.x, 0.07, ep.z); this.wardRing.scale.setScalar(WARD.r * (0.9 + Math.sin(now * 9) * 0.03));
    (this.wardRing.material as T.MeshBasicMaterial).opacity = ward * (0.7 + this.wardHit * 1.5);
    this.wardGlow.position.set(ep.x, 1.0, ep.z); this.wardGlow.scale.set(WARD.r * 2.2, WARD.r * 1.9, 1); wg.opacity = ward * (0.22 + this.wardHit * 0.8);
    // archers drawing: the red line follows the hero, then locks (brighter and wider) before the arrow goes
    const drawing = g.foes.filter((f) => f.kind === 'archer' && f.state === 'windup' && f.atk);
    this.aims.forEach((l, i) => {
      const f = drawing[i], r = this.aimEnds[i]; l.visible = r.visible = !!f; if (!f) return;
      const a = f.atk!, locked = f.t >= a.windup - ARROW.lock, u = f.t / a.windup, fp = this.L(f.x, f.z), tp = this.L(f.aimX, f.aimZ);
      const ddx = tp.x - fp.x, ddz = tp.z - fp.z, len = Math.hypot(ddx, ddz) || 1;
      l.position.set(fp.x + (ddx / len) * 0.5, 0.06, fp.z + (ddz / len) * 0.5); l.rotation.y = Math.atan2(ddx, ddz); l.scale.set(locked ? 0.2 : 0.07, 1, len + 1.5);
      (l.material as T.MeshBasicMaterial).opacity = locked ? 0.75 + Math.sin(now * 30) * 0.2 : 0.2 + u * 0.4;
      r.position.set(tp.x, 0.065, tp.z); r.scale.setScalar(locked ? 0.5 : 0.75 - u * 0.2); (r.material as T.MeshBasicMaterial).opacity = locked ? 0.9 : 0.35;
    });
    // arrows in flight: the painted arrow, on two crossed cards so it reads from any side
    while (this.arrows.length < g.arrows.length) {
      const o = new T.Group(), t = loadTex('arrow'), m = new T.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.1, side: T.DoubleSide, depthWrite: false, fog: false });
      const a = mesh(new T.PlaneGeometry(0.95, 0.16), m, 0, 0, 0, o), b = mesh(new T.PlaneGeometry(0.95, 0.16), m, 0, 0, 0, o); a.rotation.y = PI / 2; b.rotation.set(PI / 2, PI / 2, 0, 'YXZ');
      this.scene.add(o); this.arrows.push(o);
    }
    this.arrows.forEach((o, i) => {
      const a = g.arrows[i]; o.visible = !!a; if (!a) return;
      const p = this.L(a.x, a.z); o.position.set(p.x, 1.05, p.z); o.rotation.y = Math.atan2(a.vx, a.vz) + this.duel.rot;
    });
  }
  /** the quest arrow: a chevron on the ground a little ahead of Dora, turned along the way to the goal (round walls and
   *  gorges), a medallion on the goal itself, and the goal's place for the page's pointer at the edge of the screen */
  private questArrow(w: World | null, now: number) {
    const g: Goal | null = w && this.quest && w.mode === 'walk' ? nextGoal(w) : null;
    this.chev.visible = this.goalMark.visible = false; this.goalEdge = null;
    if (!w || !g) return;
    const d = Math.hypot(g.x - w.x, g.z - w.z), dir = this.guide.dir(w, g);
    if (dir && d > 2.2) {
      const k = 2.1 + Math.sin(now * 3) * 0.16;
      this.chev.visible = true; this.chev.position.set(w.x + dir.x * k, 0.05, w.z + dir.z * k); this.chev.rotation.y = Math.atan2(dir.x, dir.z) + PI;
      (this.chev.material as T.MeshBasicMaterial).opacity = Math.min(1, (d - 2.2) / 1.5) * (0.8 + Math.sin(now * 3) * 0.15);
    }
    this.goalMark.visible = d > 1; this.goalMark.position.set(g.x, 0.06 + Math.sin(now * 2) * 0.02, g.z); this.goalMark.rotation.y = now * 0.5;
    (this.goalMark.material as T.MeshBasicMaterial).opacity = 0.75 + Math.sin(now * 2.5) * 0.2;
    // on screen or off it: off it (or behind the camera), the pointer sits on the edge on the goal's side
    this.cam.updateMatrixWorld(); const v = this.tmp.set(g.x, 1, g.z).applyMatrix4(this.cam.matrixWorldInverse);
    let sx: number, sy: number;
    if (v.z < -0.1) { const q = this.tmp.set(g.x, 1, g.z).project(this.cam); if (Math.abs(q.x) < 0.9 && Math.abs(q.y) < 0.85) return; sx = q.x; sy = q.y; }
    else { sx = v.x >= 0 ? 1 : -1; sy = -0.6; }
    const ang = Math.atan2(sy, sx), cx = Math.cos(ang), cy = Math.sin(ang), m = 0.44, t = Math.min(m / Math.max(1e-3, Math.abs(cx)), m / Math.max(1e-3, Math.abs(cy)));
    this.goalEdge = { x: 0.5 + cx * t, y: 0.5 - cy * t, ang };
  }
  private hideFightFx(dt: number) {
    this.sweepArc.visible = this.wardRing.visible = false; (this.wardGlow.material as T.SpriteMaterial).opacity = 0;
    for (const l of this.aims) l.visible = false; for (const r of this.aimEnds) r.visible = false; for (const o of this.arrows) o.visible = false;
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
    const phone = this.cam.aspect < 1, upright = phone;
    // the lens: wider for the ending, so the Lamp and the two of them fit together
    const fov = (w && w.mode === 'end' ? 52 : 42) * (phone ? 60 / 42 : 1);
    if (Math.abs(this.cam.fov - fov) > 0.01) { this.cam.fov += (fov - this.cam.fov) * Math.min(1, dt * 2); this.cam.updateProjectionMatrix(); }
    const tanV = Math.tan((this.cam.fov * PI) / 360), tanH = tanV * this.cam.aspect;
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
      const me = g.me, tg = g.targetFoe ?? g.living[0], d = this.L(me.x, me.z);
      if (tg && g.phase !== 'won') {
        // close in, side-on: near enough that the two fighters fill about half the height of the frame, far enough that
        // both stay in it. A phone held upright looks along the line from behind Dora's shoulder instead, so the pair
        // still fits a narrow screen without pulling far back.
        // the hero in front and their foe; the partner is kept behind the camera's line, like Enzo always was
        const f = this.L(tg.x, tg.z), en = g.hero === 'dora' ? this.L(g.enzo.x, g.enzo.z) : this.L(g.x, g.z), big = tg.kind === 'bear';
        // an archer drawing (or an arrow in flight) joins the frame, so her red line can be seen
        const pts = [d, f], bowed = g.foes.find((o) => o.kind === 'archer' && o.id !== tg.id && (o.state === 'windup' || o.state === 'strike' || (o.state === 'recover' && g.arrows.length > 0)));
        if (bowed) pts.push(this.L(bowed.x, bowed.z));
        const xs = pts.map((o) => o.x), zs = pts.map((o) => o.z);
        const mx = (Math.min(...xs) + Math.max(...xs)) / 2, mz = (Math.min(...zs) + Math.max(...zs)) / 2, ddx = f.x - d.x, ddz = f.z - d.z, lf = Math.hypot(ddx, ddz) || 1, ux = ddx / lf, uz = ddz / lf;
        let l = lf; for (const a of pts) for (const c of pts) l = Math.max(l, Math.hypot(a.x - c.x, a.z - c.z));
        let nx = uz, nz = -ux; if ((this.camPos.x - mx) * nx + (this.camPos.z - mz) * nz < 0) { nx = -nx; nz = -nz; }
        if ((en.x - mx) * nx + (en.z - mz) * nz > 0.6) { nx = -nx; nz = -nz; }
        const turn = upright ? 1.0 : 0.18, cx = nx * Math.cos(turn) - ux * Math.sin(turn), cz = nz * Math.cos(turn) - uz * Math.sin(turn);
        const half = (l / 2) * Math.cos(turn) + (big ? 1.7 : 1.25) * (upright ? 0.8 : 1);
        // an archer at the back: pull out a little more
        const bow = g.living.some((o) => o.kind === 'archer') ? 1.1 : 1;
        const dist = Math.max(big ? 4.2 : 3.4, half / tanH, (big ? 2.9 : 2.0) / (2 * tanV * 0.62)) * bow;
        tx = mx + cx * dist; tz = mz + cz * dist; ty = big ? 1.9 : 1.55; lx = mx; lz = mz; ly = big ? 1.25 : 0.95;
        // a close camera has to keep up with dodges and lunges
        rate = 3.6;
      } else { this.orbit += dt * 0.3; tx = d.x + Math.sin(this.orbit) * 5.5; tz = d.z + Math.cos(this.orbit) * 5.5; ty = 2.2; lx = d.x; lz = d.z; ly = 1; rate = 2.4; }
    } else if (w && w.mode === 'talk') {
      // the speaker and Dora, from the side
      const who = w.talk?.who ? w.npcs().find((n) => n.id === w.talk!.who) : null;
      const d = DUELS.find((o) => o.before === w.talk?.scene || o.after === w.talk?.scene && o.area === w.area);
      const st = STONES.find((s) => s.scene === w.talk?.scene && s.area === w.area), sign = AREAS[w.area].signs.find((s) => s.scene === w.talk?.scene);
      const o = who ? { x: who.x, z: who.z } : d ? d.stand[0] : st ? { x: st.x, z: st.z } : sign ? { x: sign.x, z: sign.z } : { x: w.enzo.x, z: w.enzo.z };
      const s = side(dx, dz, o.x, o.z, 3.2, 1.9); tx = s.x; tz = s.z; ty = s.y; lx = s.lx; lz = s.lz; ly = 1.05; rate = 3;
    } else if (w && w.mode === 'end') {
      // the end: from behind the two of them, low, looking up the Condor Gate to the Lamp. The camera steps back until
      // the Lamp's top and their feet both fit, and never past the wall behind the arena
      const gate = AREAS[w.area].props.find((o) => o.kind === 'condorgate') ?? { x: 0, z: -50 };
      const mx = (dx + w.enzo.x) / 2, mz = (dz + w.enzo.z) / 2; let ux = mx - gate.x, uz = mz - gate.z; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
      const top = 16.9, eye = 0.85, room = Math.max(0, (-26 - mz) / Math.max(0.2, uz));
      let dc = 3.2;
      for (; dc < 16; dc += 0.25) { const dg = ul + dc; if (Math.atan((top - eye) / dg) + Math.atan(eye / dc) < Math.atan(tanV) * 2 - 0.1) break; if (dc >= room) break; }
      this.orbit += dt * 0.12; const sway = Math.sin(this.orbit) * 0.5;
      tx = mx + ux * dc - uz * sway; tz = mz + uz * dc + ux * sway; ty = eye;
      const dg = ul + dc, up = Math.atan((top - eye) / dg), down = Math.atan(eye / dc), pitch = (up - down) / 2;
      lx = gate.x; lz = gate.z; ly = eye + Math.tan(pitch) * dg; rate = 1.2;
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
/** a foe close to the one waiting is winding up: the partner shows a guard */
function threatNear(g: Fight) {
  const m = g.hero === 'dora' ? g.enzo : g;
  return g.foes.some((f) => f.state === 'windup' && Math.hypot(f.x - m.x, f.z - m.z) < 3.5);
}
function doraFightFrame(g: Fight, walked: number, moving: boolean): string {
  const t = g.t;
  switch (g.state) {
    case 'wait': return moving ? walkCycle('walk-side', walked, 0.5) : threatNear(g) ? 'guard' : 'wait';
    case 'tagout': return t < 10 ? 'tag-out' : walkCycle('walk-side', walked, 0.5);
    case 'help': return t < CUTS[0].hit - 2 ? 'windup' : 'cut-a';
    case 'tagin': return t < DASH.hit - 2 ? 'dash' : t < DASH.hit + 6 ? 'lunge' : 'stance';
    case 'run': return walkCycle('walk-side', walked, 0.5);
    case 'cut1': return t < CUTS[0].hit - 2 ? 'windup' : 'cut-a';
    case 'cut2': return 'cut-b';
    case 'cut3': return t < CUTS[2].hit - 3 ? 'heavy' : 'lunge';
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
function enzoFightFrame(g: Fight, walked: number, moving: boolean, near: boolean, warded: boolean): string {
  const e = g.enzo, t = e.t;
  switch (e.state) {
    case 'leap': return 'leap';
    case 'strike': return t < 18 ? 'strike' : 'ready';
    case 'sweep': return t < SWEEP.hit - 3 ? 'sweep-wind' : t < SWEEP.hit + 8 ? 'sweep' : 'sweep-end';
    case 'help': return t < SWEEP.hit - 3 ? 'sweep-wind' : t < SWEEP.hit + 8 ? 'sweep' : 'sweep-end';
    case 'ward': return warded ? 'ward-hit' : 'ward';
    case 'hop': return t < HOP.len - 2 ? 'hop' : 'f-stance';
    case 'hit': return 'f-hit';
    case 'dead': return 'f-down';
    case 'win': return 'cheer';
    case 'run': return walkCycle('walk-side', walked, 0.42);
    case 'tagout': return t < 10 ? 'tag-out' : walkCycle('walk-side', walked, 0.42);
    case 'wait': return moving ? walkCycle('walk-side', walked, 0.42) : g.phase === 'won' ? 'cheer' : near ? 'brace' : 'ready';
    default: return g.phase === 'won' ? 'cheer' : 'f-stance';
  }
}
function foeFightFrame(f: Foe, walked: number, parry: boolean): string {
  if (f.look === 'archer') { // the vizcacha archer: a draw, the aim (the line has locked), the release
    switch (f.state) {
      case 'windup': return f.t < (f.atk?.windup ?? 56) - ARROW.lock ? 'draw' : 'aim';
      case 'strike': return 'release';
      case 'recover': return f.t < 14 ? 'release' : 'idle';
      case 'hit': case 'deflected': return 'hit';
      case 'broken': return 'broken';
      case 'dead': return 'down';
      default: { const i = Math.floor(walked / 0.4) % 4; return f.state === 'stalk' && (f.t % 40 < 3 || i === 3) ? 'idle' : `walk-${Math.min(i, 2)}`; }
    }
  }
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
