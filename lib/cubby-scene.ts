// Cubby Valley's drawing, in Three.js: a hand-painted block atlas made at load, a light-aware block shader (sky light
// that follows the day, warm lantern light, soft corner shading, fog), chunk meshes rebuilt nearest-first within a time
// budget, the sky (gradient dome, sun, moon, stars, drifting voxel clouds), Dora, Enzo, the neighbours and the night's
// creatures as animated voxel toys, the held tool, block highlight, crack and ghost, particles, fireflies and lantern
// halos, the camera (first person or close behind), the summer fair, and item icons. Drawing only: the page owns the
// clock, the input and the game.
import * as T from 'three';
import { CubbyGame, phaseOf, daylight, BODY, type Body, type Critter, type Ev } from './cubby-game';
import { BLOCKS, TILES, W, D, H, CH, World, hash3, CROSS_TILE, type Spot } from './cubby-world';
import { meshChunk, type Quads } from './cubby-mesh';
import { chinchilla, neighbour, critter, prop, item, meshPart, meshModel, ITEM_MODELS, type Model, type MeshData } from './cubby-models';
import { ITEMS, type CritterKind, type NeighbourId } from './cubby-content';

export interface View {
  mode: 'first' | 'third';
  /** 0–1 dig progress on the aimed block, or -1 */
  dig: number;
  aim: { x: number; y: number; z: number } | null;
  ghost: { x: number; y: number; z: number; ok: boolean } | null;
  held: string | null;
  /** seconds since the last swing or dig chip, for the arm animation */
  swing: number;
  /** a cinematic orbit (the fair), or null */
  orbit: { x: number; y: number; z: number; t: number } | null;
  menu: boolean;
}
export interface Box { x: number; y: number; w: number; h: number; on: boolean }

const ATLAS_COLS = 8, TILE = 16;
const ATLAS_ROWS = Math.ceil(TILES.length / ATLAS_COLS);

// ---------------------------------------------------------------- the painted atlas
function rgb(h: string) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
/** Paints every block tile, 16×16, with a seeded hand-painted wobble. Returns the canvas and each tile's average colour. */
export function paintAtlas() {
  const cv = document.createElement('canvas');
  cv.width = ATLAS_COLS * TILE; cv.height = ATLAS_ROWS * TILE;
  const x = cv.getContext('2d')!;
  const img = x.createImageData(cv.width, cv.height);
  const avg: Record<string, [number, number, number]> = {};
  TILES.forEach((name, ti) => {
    const ox = (ti % ATLAS_COLS) * TILE, oy = Math.floor(ti / ATLAS_COLS) * TILE;
    let sr = 0, sg = 0, sb = 0, sn = 0;
    for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
      const h = hash3(ti * 31 + 7, px, py, 0), h2 = hash3(ti * 17 + 3, px >> 1, py >> 1, 1);
      let c: number[] = [255, 255, 255], a = 255;
      const mix = (p: number[], q: number[], t: number) => p.map((v, i) => v + (q[i] - v) * t);
      const pick = (cols: string[], t: number) => rgb(cols[Math.min(cols.length - 1, Math.floor(t * cols.length))]);
      switch (name) {
        case 'grass': c = pick(['#5fa83f', '#6cb646', '#78c04e', '#68b244'], h2 * 0.7 + h * 0.3); if (h > 0.93) c = rgb('#93d466'); break;
        case 'grass_side': c = py < 3 + (h2 > 0.5 ? 1 : 0) ? pick(['#5fa83f', '#6cb646'], h) : pick(['#9a6b44', '#8a5e3a', '#a77650'], h2 * 0.6 + h * 0.4); break;
        case 'soil': c = pick(['#9a6b44', '#8a5e3a', '#a77650', '#7f5634'], h2 * 0.6 + h * 0.4); break;
        case 'stone': { c = pick(['#8d9097', '#9a9da4', '#858890', '#a6a9af'], h2 * 0.7 + h * 0.3); if ((px + py * 3) % 11 === 0 && h > 0.5) c = rgb('#74777e'); break; }
        case 'chalk': c = pick(['#efe7d4', '#f5efe0', '#e6dcc6', '#f8f3e8'], h2 * 0.5 + h * 0.5); if (py % 5 === 0 && h > 0.4) c = rgb('#ddd2bb'); break;
        case 'sand': c = pick(['#ecd79c', '#f2e0aa', '#e3cc8e', '#f6e6b6'], h); break;
        case 'water': c = pick(['#4f9fd8', '#5aaee2', '#62b7e8'], h2 * 0.6 + h * 0.4); if ((px + py * 2 + Math.floor(h2 * 3)) % 9 === 0) c = rgb('#9fd6f5'); break;
        case 'birch_top': { const r = Math.hypot(px - 7.5, py - 7.5); c = r > 6.8 ? rgb('#f2efe8') : (Math.floor(r) % 2 ? rgb('#e7cfa2') : rgb('#d9bb86')); break; }
        case 'birch_side': c = rgb(h2 > 0.82 && py % 4 < 2 ? '#3b3632' : h > 0.9 ? '#cfcac0' : '#f2efe8'); if (px === 0 || px === 15) c = rgb('#dcd7cc'); break;
        case 'leaves': c = pick(['#69b84a', '#7cc85a', '#5aa83e', '#8fd468'], h2 * 0.5 + h * 0.5); if (h > 0.95) c = rgb('#b6e88a'); break;
        case 'pebbles': { const cell = hash3(99, px >> 2, py >> 2, 2); c = pick(['#9aa3ab', '#b7bcc0', '#8a8f93', '#c9c3b8', '#a89b8a'], cell); if ((px & 3) === 0 || (py & 3) === 0) c = mix(c, [90, 95, 100], 0.35); break; }
        case 'clay': c = pick(['#b98a74', '#c4957f', '#ae7f69'], h2 * 0.7 + h * 0.3); break;
        case 'ironstone': c = pick(['#8d9097', '#9a9da4', '#858890'], h2); if (hash3(5, px >> 1, py >> 1, 3) > 0.78) c = pick(['#c87a46', '#d98b52', '#b06a3a'], h); break;
        case 'hay_top': c = pick(['#e8c75a', '#d9b44a', '#f2d46a'], h); if ((px + py) % 4 === 0) c = rgb('#c9a23a'); break;
        case 'hay_side': c = pick(['#e8c75a', '#d9b44a', '#f2d46a'], h2); if (py === 4 || py === 11) c = rgb('#a8742a'); break;
        case 'planks': c = pick(['#d8b07a', '#cfa46c', '#e2bc88'], hash3(4, 0, py >> 2, 5) * 0.8 + h * 0.2); if (py % 4 === 0) c = rgb('#a77a48'); if (px === ((py >> 2) * 5) % 16 && py % 4 !== 0) c = rgb('#b8895a'); break;
        case 'brick': { const row = py >> 2, off = row % 2 ? 4 : 0; c = pick(['#c0603f', '#b8573e', '#cc6a48'], hash3(8, (px + off) >> 3, row, 6) * 0.7 + h * 0.3); if (py % 4 === 3 || (px + off) % 8 === 7) c = rgb('#e2c7ae'); break; }
        case 'glass': { a = 70; c = rgb('#d6f0ff'); if (px === 0 || py === 0 || px === 15 || py === 15) { a = 255; c = rgb('#a8c8d8'); } if (px === py + 3 && px < 9 && px > 4) { a = 200; c = [255, 255, 255]; } break; }
        case 'bookshelf': { c = rgb('#b8895a'); if (py === 0 || py === 7 || py === 8 || py === 15) c = rgb('#8a5e3a'); else if (px > 0 && px < 15) c = pick(['#d24a4a', '#4f8fd6', '#6eab4f', '#f2c24a', '#9a6ad0'], hash3(12, px >> 1, py >> 3, 7)); if (px % 2 === 1 && py % 8 > 1 && py % 8 < 7 && h > 0.7) c = mix(c, [255, 255, 255], 0.3); break; }
        case 'chalk_tile': c = (px === 0 || py === 0) ? rgb('#d8cdb6') : pick(['#fbf7ee', '#f6f0e2'], h); break;
        case 'rose_tile': c = (px === 0 || py === 0) ? rgb('#c45a74') : pick(['#ef8fa8', '#f39cb2', '#e8849f'], h); if (Math.hypot(px - 8, py - 8) < 3) c = rgb('#fbd0dc'); break;
        case 'sky_tile': c = (px === 0 || py === 0) ? rgb('#3f6fa8') : pick(['#79b4ea', '#86bff0', '#6fa9e0'], h); if ((px + py) % 8 === 0) c = rgb('#d6ecff'); break;
        case 'sun_tile': c = (px === 0 || py === 0) ? rgb('#c98a1a') : pick(['#f6c23a', '#f9cf55', '#f0b62e'], h); if (Math.abs(px - 8) + Math.abs(py - 8) < 4) c = rgb('#fff1b0'); break;
        case 'path': { const cell = hash3(77, px >> 2, py >> 2, 2); c = pick(['#c9c3b8', '#b7b0a2', '#d6cfc0', '#a89b8a'], cell); if ((px & 3) === 0 || (py & 3) === 0) c = rgb('#8a8070'); break; }
        case 'tallgrass': { a = 0; const blades = [3, 6, 8, 11, 13]; for (const bx of blades) { const top = 4 + Math.floor(hash3(13, bx, 0, 9) * 6); if (Math.abs(px - bx - (15 - py) * 0.12 * (bx % 2 ? 1 : -1)) < 0.9 && py >= top) { a = 255; c = mix(rgb('#e3c85a'), rgb('#6cb646'), py / 15); } } break; }
        case 'daisy': { a = 0; if (px >= 7 && px <= 8 && py >= 7) { a = 255; c = rgb('#4f8a3a'); } if (py >= 10 && py <= 11 && px >= 4 && px <= 6) { a = 255; c = rgb('#5fa83f'); } const r = Math.hypot(px - 7.5, py - 4.5); if (r < 3.6) { a = 255; c = r < 1.5 ? rgb('#f6c23a') : rgb('#ffffff'); } break; }
        case 'bluebell': { a = 0; if (px >= 7 && px <= 8 && py >= 4) { a = 255; c = rgb('#4f8a3a'); } for (const [bx, by] of [[5, 6], [10, 4], [5, 10], [10, 9]]) if (Math.abs(px - bx) <= 1 && py >= by && py <= by + 2) { a = 255; c = rgb(py === by + 2 ? '#8fb0ff' : '#5a6fd8'); } break; }
        case 'berrybush': { c = pick(['#4f9a3a', '#5aa83e', '#468a34'], h2 * 0.5 + h * 0.5); const b = hash3(21, px >> 2, py >> 2, 4); if (b > 0.55 && (px & 3) > 0 && (py & 3) > 0 && (px & 3) < 3 && (py & 3) < 3) c = rgb((px + py) % 3 ? '#d0283c' : '#ff6a7a'); break; }
        case 'cotton': { a = 0; if (px >= 7 && px <= 8 && py >= 6) { a = 255; c = rgb('#6a8a3a'); } for (const [bx, by] of [[7.5, 4], [4, 7], [11, 6]]) if (Math.hypot(px - bx, py - by) < 2.6) { a = 255; c = h > 0.7 ? rgb('#e8e3f0') : rgb('#ffffff'); } break; }
        case 'mushroom': { a = 0; if (px >= 6 && px <= 9 && py >= 8) { a = 255; c = rgb('#f3e6d6'); } const r = Math.hypot((px - 7.5) / 1.4, py - 7); if (py <= 8 && r < 4.2) { a = 255; c = (px + py) % 5 === 0 ? rgb('#fff6e8') : rgb('#d2483c'); } break; }
        case 'sapling': { a = 0; if (px >= 7 && px <= 8 && py >= 6) { a = 255; c = rgb('#e7e2d6'); } for (const [bx, by] of [[5, 6], [10, 4], [8, 2]]) if (Math.hypot(px - bx, py - by) < 2.4) { a = 255; c = rgb('#7cc85a'); } break; }
        case 'deepstone': c = pick(['#3e4148', '#46494f', '#35383e'], h2 * 0.5 + h * 0.5); break;
        case 'white': c = [255, 255, 255]; break;
      }
      const i = ((oy + py) * cv.width + ox + px) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = a;
      if (a > 100) { sr += c[0]; sg += c[1]; sb += c[2]; sn++; }
    }
    avg[name] = sn ? [sr / sn / 255, sg / sn / 255, sb / sn / 255] : [1, 1, 1];
  });
  x.putImageData(img, 0, 0);
  return { canvas: cv, avg };
}

// ---------------------------------------------------------------- the block shader
const VERT = `
attribute float tile; attribute vec2 light;
varying vec2 vUv; varying float vTile; varying vec3 vCol; varying vec2 vLight; varying float vFog;
uniform float uTime; uniform float uWave;
void main() {
  vUv = uv; vTile = tile; vCol = color; vLight = light;
  vec3 p = position;
  if (uWave > 0.5) p.y += sin(p.x * 1.3 + uTime * 1.6) * 0.03 + cos(p.z * 1.1 + uTime * 1.3) * 0.03;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D uAtlas; uniform float uDay; uniform vec3 uSky; uniform vec3 uLamp; uniform vec3 uAmb;
uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform float uAlpha; uniform float uCut; uniform float uTime; uniform float uWave;
varying vec2 vUv; varying float vTile; varying vec3 vCol; varying vec2 vLight; varying float vFog;
void main() {
  vec4 tex = vec4(1.0);
  if (vTile > -0.5) {
    float col = mod(vTile, ${ATLAS_COLS}.0), row = floor(vTile / ${ATLAS_COLS}.0);
    vec2 f = fract(vUv + (uWave > 0.5 ? vec2(uTime * 0.03, uTime * 0.02) : vec2(0.0)));
    vec2 px = (vec2(0.5) + f * 15.0) / 16.0;
    vec2 uv = vec2((col + px.x) / ${ATLAS_COLS}.0, 1.0 - (row + 1.0 - px.y) / ${ATLAS_ROWS}.0);
    tex = texture2D(uAtlas, uv);
  }
  if (tex.a < uCut) discard;
  float sky = pow(vLight.x, 1.5) * uDay, lamp = pow(vLight.y, 1.7);
  vec3 light = uAmb + sky * uSky + lamp * uLamp * (1.0 - 0.45 * uDay * vLight.x);
  vec3 c = tex.rgb * vCol * light;
  c = mix(c, uFog, smoothstep(uFogNear, uFogFar, vFog));
  gl_FragColor = vec4(c, uAlpha < 1.0 ? (uCut > 0.0 && uCut < 0.1 ? tex.a : uAlpha) : 1.0);
}`;

type Rig = { root: T.Group; parts: Record<string, T.Object3D>; mats: T.MeshBasicMaterial[]; model: Model; held?: T.Object3D; extra?: T.Object3D };

export type CubbyScene = ReturnType<typeof createCubbyScene>;

export function createCubbyScene(canvas: HTMLCanvasElement) {
  const phone = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
  const renderer = new T.WebGLRenderer({ canvas, antialias: !phone, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 1.75));
  renderer.outputColorSpace = T.LinearSRGBColorSpace; renderer.toneMapping = T.NoToneMapping;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(70, 1, 0.05, 220);
  scene.add(camera);
  const geos = new Set<T.BufferGeometry>(), mats = new Set<T.Material>(), texs = new Set<T.Texture>();
  const gg = <G extends T.BufferGeometry>(g: G) => (geos.add(g), g);
  const mm = <M extends T.Material>(m: M) => (mats.add(m), m);
  const lin = (c: T.Color, r: number, g: number, b: number) => c.setRGB(r, g, b, T.LinearSRGBColorSpace);

  const { canvas: atlasCanvas, avg } = paintAtlas();
  const atlas = new T.CanvasTexture(atlasCanvas);
  atlas.magFilter = T.NearestFilter; atlas.minFilter = T.NearestFilter; atlas.generateMipmaps = false; atlas.colorSpace = T.NoColorSpace; texs.add(atlas);
  const uniforms = {
    uAtlas: { value: atlas }, uDay: { value: 1 }, uSky: { value: new T.Color(1, 1, 1) }, uLamp: { value: new T.Color(1, 0.78, 0.46) },
    uAmb: { value: new T.Color(0.07, 0.07, 0.1) }, uFog: { value: new T.Color(0.8, 0.9, 1) }, uFogNear: { value: 40 }, uFogFar: { value: 80 },
    uAlpha: { value: 1 }, uCut: { value: 0.5 }, uTime: { value: 0 }, uWave: { value: 0 },
  };
  const blockMat = (o: { alpha?: number; cut?: number; wave?: boolean; side?: T.Side } = {}) => mm(new T.ShaderMaterial({
    uniforms: { ...uniforms, uAlpha: { value: o.alpha ?? 1 }, uCut: { value: o.cut ?? 0.5 }, uWave: { value: o.wave ? 1 : 0 } },
    vertexShader: VERT, fragmentShader: FRAG, vertexColors: true, transparent: (o.alpha ?? 1) < 1, depthWrite: (o.alpha ?? 1) >= 1, side: o.side ?? T.FrontSide,
  }));
  const solidMat = blockMat({ cut: -1 }), cutMat = blockMat({ cut: 0.5, side: T.DoubleSide }), waterMat = blockMat({ alpha: 0.72, cut: -1, wave: true, side: T.DoubleSide });
  const glassMat = blockMat({ cut: 0.02, alpha: 0.999 });
  const blockMats = [solidMat, cutMat, waterMat, glassMat];
  const syncUniforms = () => { for (const m of blockMats) for (const k of ['uDay', 'uSky', 'uLamp', 'uAmb', 'uFog', 'uFogNear', 'uFogFar', 'uTime'] as const) (m.uniforms[k] as { value: unknown }).value = uniforms[k].value; };

  let game: CubbyGame | null = null, time = 0, closed = false;
  const chunkRoot = new T.Group(); scene.add(chunkRoot);
  const chunks = new Map<number, T.Mesh[]>();
  let builtOnce = new Set<number>();
  const geoFrom = (q: Quads) => {
    const g = gg(new T.BufferGeometry());
    g.setAttribute('position', new T.Float32BufferAttribute(q.pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(q.uv, 2));
    g.setAttribute('tile', new T.Float32BufferAttribute(q.tile, 1));
    g.setAttribute('color', new T.Float32BufferAttribute(q.col, 3));
    g.setAttribute('light', new T.Float32BufferAttribute(q.light, 2));
    g.setIndex(q.index); g.computeBoundingSphere();
    return g;
  };
  function buildChunk(key: number) {
    if (!game) return;
    const cx = key % 8, cz = Math.floor(key / 8) % 8, cy = Math.floor(key / 64);
    for (const m of chunks.get(key) ?? []) { chunkRoot.remove(m); m.geometry.dispose(); geos.delete(m.geometry as T.BufferGeometry); }
    const out: T.Mesh[] = [];
    if (cx < W / CH && cz < D / CH && cy < H / CH) {
      const c = meshChunk(game.world, cx, cy, cz);
      // glass is drawn after the solids, see-through
      const glassQ: Quads = { pos: [], uv: [], tile: [], col: [], light: [], index: [] }, cutQ: Quads = { pos: [], uv: [], tile: [], col: [], light: [], index: [] };
      const gi = TILES.indexOf('glass');
      for (let i = 0; i < c.cutout.index.length; i += 6) {
        const a = c.cutout.index[i], to = c.cutout.tile[a] === gi ? glassQ : cutQ;
        const base = to.pos.length / 3, verts = [...new Set(c.cutout.index.slice(i, i + 6))].sort((p, q) => p - q);
        for (const v of verts) { to.pos.push(...c.cutout.pos.slice(v * 3, v * 3 + 3)); to.uv.push(...c.cutout.uv.slice(v * 2, v * 2 + 2)); to.tile.push(c.cutout.tile[v]); to.col.push(...c.cutout.col.slice(v * 3, v * 3 + 3)); to.light.push(...c.cutout.light.slice(v * 2, v * 2 + 2)); }
        for (let k = 0; k < 6; k++) to.index.push(base + verts.indexOf(c.cutout.index[i + k]));
      }
      for (const [q, mat, order] of [[c.solid, solidMat, 0], [cutQ, cutMat, 1], [glassQ, glassMat, 2], [c.water, waterMat, 3]] as [Quads, T.ShaderMaterial, number][]) {
        if (!q.index.length) continue;
        const mesh = new T.Mesh(geoFrom(q), mat); mesh.renderOrder = order; mesh.matrixAutoUpdate = false;
        chunkRoot.add(mesh); out.push(mesh);
      }
    }
    chunks.set(key, out); builtOnce.add(key);
  }
  const allKeys: number[] = [];
  for (let cy = 0; cy < H / CH; cy++) for (let cz = 0; cz < D / CH; cz++) for (let cx = 0; cx < W / CH; cx++) allKeys.push(World.chunkKey(cx, cy, cz));
  /** Rebuilds dirty chunks nearest the player first, for at most `budget` ms. */
  function rebuild(budget: number) {
    if (!game) return;
    const d = game.world.dirty; if (!d.size) return;
    const me = game.me, pcx = me.x / CH, pcy = me.y / CH, pcz = me.z / CH;
    const keys = [...d].sort((a, b) => dist(a) - dist(b));
    function dist(k: number) { const cx = k % 8 + 0.5, cz = Math.floor(k / 8) % 8 + 0.5, cy = Math.floor(k / 64) + 0.5; return Math.hypot(cx - pcx, (cy - pcy) * 0.7, cz - pcz); }
    const t0 = performance.now();
    for (const k of keys) { d.delete(k); buildChunk(k); if (performance.now() - t0 > budget) break; }
  }

  // ---------------------------------------------------------------- the sky
  const skyMat = mm(new T.ShaderMaterial({
    uniforms: { uTop: { value: new T.Color() }, uHor: { value: new T.Color() }, uSun: { value: new T.Vector3(0, 1, 0) }, uSunCol: { value: new T.Color(1, 0.9, 0.6) }, uNight: { value: 0 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uNight; varying vec3 vD;
      void main(){ float h = clamp(vD.y, -0.2, 1.0); vec3 c = mix(uHor, uTop, pow(max(h, 0.0), 0.6));
      float s = max(dot(vD, normalize(uSun)), 0.0); c += uSunCol * (pow(s, 600.0) * 1.6 + pow(s, 12.0) * 0.25) * (1.0 - uNight);
      vec3 m = -normalize(uSun); float ms = max(dot(vD, m), 0.0); c += vec3(0.85, 0.9, 1.0) * pow(ms, 900.0) * 1.2 * uNight + vec3(0.2, 0.25, 0.4) * pow(ms, 20.0) * 0.3 * uNight;
      gl_FragColor = vec4(c, 1.0); }`,
    side: T.BackSide, depthWrite: false, fog: false,
  }));
  const sky = new T.Mesh(gg(new T.SphereGeometry(190, 24, 12)), skyMat); sky.renderOrder = -10; scene.add(sky);
  const starGeo = gg(new T.BufferGeometry()), starPos: number[] = [];
  for (let i = 0; i < 260; i++) { const a = hash3(5, i, 0, 0) * Math.PI * 2, e = Math.asin(0.15 + hash3(6, i, 0, 0) * 0.85); starPos.push(Math.cos(a) * Math.cos(e) * 180, Math.sin(e) * 180, Math.sin(a) * Math.cos(e) * 180); }
  starGeo.setAttribute('position', new T.Float32BufferAttribute(starPos, 3));
  const starMat = mm(new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  const stars = new T.Points(starGeo, starMat); stars.renderOrder = -9; scene.add(stars);
  // voxel clouds
  const cloudMat = mm(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false }));
  const clouds = new T.Group(); scene.add(clouds);
  for (let i = 0; i < 9; i++) {
    const cg = new T.Group();
    const n = 3 + Math.floor(hash3(9, i, 0, 0) * 4);
    for (let k = 0; k < n; k++) { const b = new T.Mesh(gg(new T.BoxGeometry(6 + hash3(9, i, k, 1) * 8, 1.6, 4 + hash3(9, i, k, 2) * 6)), cloudMat); b.position.set(k * 4 - n * 2, (k % 2) * 0.4, hash3(9, i, k, 3) * 4 - 2); cg.add(b); }
    cg.position.set(hash3(9, i, 0, 4) * 160 - 32, 52 + hash3(9, i, 0, 5) * 10, hash3(9, i, 0, 6) * 160 - 32);
    clouds.add(cg);
  }

  // ---------------------------------------------------------------- voxel rigs
  const meshCache = new Map<string, T.BufferGeometry>();
  const geoOf = (key: string, d: MeshData) => {
    let g = meshCache.get(key);
    if (!g) {
      g = gg(new T.BufferGeometry());
      g.setAttribute('position', new T.BufferAttribute(d.pos, 3)); g.setAttribute('color', new T.BufferAttribute(d.col, 3));
      g.setIndex(new T.BufferAttribute(d.index, 1)); g.computeBoundingSphere(); meshCache.set(key, g);
    }
    return g;
  };
  function rig(m: Model, scale = 1): Rig {
    const root = new T.Group(), parts: Record<string, T.Object3D> = {}, ms: T.MeshBasicMaterial[] = [];
    const inner = new T.Group(); inner.scale.setScalar(scale); root.add(inner);
    const mat = mm(new T.MeshBasicMaterial({ vertexColors: true }));
    ms.push(mat);
    for (const p of m.parts) {
      if (!p.vox.cells.size) { parts[p.name] = new T.Group(); continue; }
      const piv = new T.Group(); piv.position.set(p.pivot[0] / 16, p.pivot[1] / 16, p.pivot[2] / 16);
      const mesh = new T.Mesh(geoOf(m.name + ':' + p.name, meshPart(m, p)), mat);
      piv.add(mesh); inner.add(piv); parts[p.name] = piv;
    }
    parts.inner = inner;
    return { root, parts, mats: ms, model: m };
  }
  const itemGeo = (key: string) => {
    const pm = prop(key), im = item(key);
    if (pm) return geoOf('prop:' + key, meshModel(pm, 1 / 16, [-8, 0, -8]));
    if (im) return geoOf('item:' + key, meshModel(im, 1 / 16, [-8, 0, -8]));
    return null;
  };
  const itemMat = mm(new T.MeshBasicMaterial({ vertexColors: true }));
  /** A block or an item as a small object (for the held tool, pick-ups and icons). */
  function thing(key: string): T.Object3D {
    if (key.startsWith('npc:') || key.startsWith('chin:')) {
      const id = key.slice(key.indexOf(':') + 1), m = key.startsWith('npc:') ? neighbour(id as NeighbourId) : chinchilla(id as 'dora' | 'enzo');
      return new T.Mesh(geoOf('whole:' + key, meshModel(m, 1 / 16, [0, 0, 0])), itemMat);
    }
    const g = itemGeo(key);
    if (g) return new T.Mesh(g, itemMat);
    const d = BLOCKS[ITEMS[key]?.block ?? 0];
    if (d.shape === 'cross') {
      const tex = TILES.indexOf((CROSS_TILE[d.id] ?? 'tallgrass') as (typeof TILES)[number]);
      const q: Quads = { pos: [-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], uv: [0, 0, 1, 0, 1, 1, 0, 1], tile: [tex, tex, tex, tex], col: Array(12).fill(1), light: [1, 0, 1, 0, 1, 0, 1, 0], index: [0, 1, 2, 0, 2, 3] };
      return new T.Mesh(geoFrom(q), cutMat);
    }
    const tiles = d.tiles ?? ['white', 'white', 'white'];
    const q: Quads = { pos: [], uv: [], tile: [], col: [], light: [], index: [] };
    const DIRS: [number[], number[], number[], number][] = [
      [[1, 0, 0], [0, 1, 0], [0, 0, 1], 0.8], [[-1, 0, 0], [0, 0, 1], [0, 1, 0], 0.8], [[0, 1, 0], [0, 0, 1], [1, 0, 0], 1],
      [[0, -1, 0], [1, 0, 0], [0, 0, 1], 0.6], [[0, 0, 1], [1, 0, 0], [0, 1, 0], 0.9], [[0, 0, -1], [0, 1, 0], [1, 0, 0], 0.9],
    ];
    for (const [n, u, v, s] of DIRS) {
      const b = q.pos.length / 3, t = n[1] > 0 ? tiles[0] : n[1] < 0 ? tiles[2] : tiles[1], tile = TILES.indexOf(t as (typeof TILES)[number]);
      const o = n.map((k) => (k > 0 ? 1 : 0));
      for (const [a, c] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const p = [0, 1, 2].map((i) => o[i] + u[i] * a + v[i] * c);
        q.pos.push(p[0] - 0.5, p[1], p[2] - 0.5);
        q.uv.push(n[1] !== 0 ? p[0] : n[0] !== 0 ? p[2] : p[0], n[1] !== 0 ? p[2] : p[1] * 0.999);
        q.tile.push(tile); q.col.push(s, s, s); q.light.push(1, 0);
      }
      q.index.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const mat = d.key === 'glass' ? glassMat : solidMat;
    const mesh = new T.Mesh(geoFrom(q), mat);
    const box = new T.Group(); box.add(mesh); return box;
  }

  const chin = [rig(chinchilla('dora')), rig(chinchilla('enzo'), 1.08)];
  for (const r of chin) scene.add(r.root);
  const npcRigs = new Map<NeighbourId, Rig>();
  const critterRigs = new Map<number, Rig & { kind: CritterKind; seen: number }>();
  const pickRoot = new T.Group(); scene.add(pickRoot);
  const pickMeshes = new Map<number, T.Object3D>();
  const leafRoot = new T.Group(); scene.add(leafRoot);
  let leafMeshes: (T.Object3D | null)[] = [];
  const shotGeo = gg(new T.BoxGeometry(0.14, 0.14, 0.14)), shotMat = mm(new T.MeshBasicMaterial({ color: 0x9aa3ab }));
  const shotRoot = new T.Group(); scene.add(shotRoot);

  // the held tool: in first person, at the bottom right of the view; in third person, in the active chinchilla's paws
  const fpHand = new T.Group(); camera.add(fpHand); fpHand.position.set(0.42, -0.38, -0.7);
  let heldKey: string | null = null, heldObj: T.Object3D | null = null, tpHeld: T.Object3D | null = null;

  // highlight, crack and ghost
  const outlineMat = mm(new T.LineBasicMaterial({ color: 0x1b1410, transparent: true, opacity: 0.55 }));
  const outline = new T.LineSegments(gg(new T.EdgesGeometry(new T.BoxGeometry(1.004, 1.004, 1.004))), outlineMat); outline.visible = false; scene.add(outline);
  const crackCv = document.createElement('canvas'); crackCv.width = 64; crackCv.height = 16;
  { const x = crackCv.getContext('2d')!; x.strokeStyle = 'rgba(30,20,15,0.85)'; x.lineWidth = 1;
    for (let s = 0; s < 4; s++) for (let k = 0; k <= s * 2 + 1; k++) { x.beginPath(); let px = s * 16 + 8, py = 8; x.moveTo(px, py); for (let j = 0; j < 3 + s; j++) { px += (hash3(3, s, k, j) - 0.5) * 9; py += (hash3(4, s, k, j) - 0.5) * 9; x.lineTo(Math.max(s * 16, Math.min(s * 16 + 15, px)), Math.max(0, Math.min(15, py))); } x.stroke(); } }
  const crackTex = new T.CanvasTexture(crackCv); crackTex.magFilter = T.NearestFilter; crackTex.minFilter = T.NearestFilter; crackTex.repeat.set(0.25, 1); crackTex.colorSpace = T.NoColorSpace; texs.add(crackTex);
  const crack = new T.Mesh(gg(new T.BoxGeometry(1.01, 1.01, 1.01)), mm(new T.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })));
  crack.visible = false; scene.add(crack);
  const ghost = new T.Mesh(gg(new T.BoxGeometry(1, 1, 1)), mm(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })));
  const ghostEdge = new T.LineSegments(gg(new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1))), mm(new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })));
  ghost.add(ghostEdge); ghost.visible = false; scene.add(ghost);

  // particles: little cubes
  const PMAX = 500;
  const pGeo = gg(new T.BoxGeometry(1, 1, 1)), pMat = mm(new T.MeshBasicMaterial({ vertexColors: false }));
  const parts = new T.InstancedMesh(pGeo, pMat, PMAX); parts.instanceMatrix.setUsage(T.DynamicDrawUsage); parts.count = 0; parts.frustumCulled = false; scene.add(parts);
  type P = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; s: number; c: T.Color; g: number };
  const plist: P[] = [];
  const tmpM = new T.Matrix4(), tmpC = new T.Color(), tmpQ = new T.Quaternion(), tmpS = new T.Vector3(), tmpP = new T.Vector3();
  let seq = 0;
  const rnd = () => hash3(1234, seq++, 0, 0);
  function burst(x: number, y: number, z: number, col: [number, number, number], n: number, o: { speed?: number; size?: number; up?: number; life?: number; grav?: number } = {}) {
    for (let i = 0; i < n && plist.length < PMAX; i++) {
      const a = rnd() * Math.PI * 2, s = (o.speed ?? 2.5) * (0.4 + rnd() * 0.8);
      const shade = 0.8 + rnd() * 0.35;
      plist.push({ x: x + (rnd() - 0.5) * 0.6, y: y + (rnd() - 0.5) * 0.6, z: z + (rnd() - 0.5) * 0.6, vx: Math.cos(a) * s, vy: (o.up ?? 3) * (0.5 + rnd()), vz: Math.sin(a) * s, life: 0, max: (o.life ?? 0.7) * (0.7 + rnd() * 0.6), s: (o.size ?? 0.12) * (0.7 + rnd() * 0.6), c: new T.Color().setRGB(col[0] * shade, col[1] * shade, col[2] * shade, T.LinearSRGBColorSpace), g: o.grav ?? 14 });
    }
  }
  const tileCol = (b: number): [number, number, number] => { const d = BLOCKS[b]; const t = d.tiles?.[1] ?? CROSS_TILE[b] ?? 'white'; return avg[t] ?? [0.8, 0.8, 0.8]; };
  const PUFF: [number, number, number] = [0.97, 0.95, 1];

  // fireflies and lantern halos
  const ffGeo = gg(new T.BufferGeometry()); const FF = 70; ffGeo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(FF * 3), 3));
  const ffMat = mm(new T.PointsMaterial({ color: 0xfff0a0, size: 5, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
  const fireflies = new T.Points(ffGeo, ffMat); fireflies.frustumCulled = false; scene.add(fireflies);
  const glowCv = document.createElement('canvas'); glowCv.width = glowCv.height = 64;
  { const x = glowCv.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,220,140,0.9)'); g.addColorStop(0.35, 'rgba(255,190,90,0.35)'); g.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
  const glowTex = new T.CanvasTexture(glowCv); texs.add(glowTex);
  const glowMat = mm(new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
  const cyanMat = mm(new T.SpriteMaterial({ map: glowTex, color: 0x80f0ff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
  const halos: T.Sprite[] = [];
  let haloScan = 0;
  function scanHalos() {
    if (!game) return;
    for (const h of halos) scene.remove(h);
    halos.length = 0;
    const me = game.me, w = game.world, X = Math.floor(me.x), Z = Math.floor(me.z);
    for (let y = 1; y < H - 1 && halos.length < 40; y++) for (let z = Math.max(0, Z - 26); z < Math.min(D, Z + 26); z++) for (let x = Math.max(0, X - 26); x < Math.min(W, X + 26); x++) {
      const b = w.get(x, y, z), k = BLOCKS[b].key;
      if (k !== 'lantern' && k !== 'lamp' && k !== 'crystal') continue;
      const s = new T.Sprite(k === 'lantern' ? glowMat : cyanMat); s.position.set(x + 0.5, y + (k === 'crystal' ? 0.4 : 0.3), z + 0.5); s.scale.setScalar(k === 'crystal' ? 1.4 : 2.2);
      s.renderOrder = 5; scene.add(s); halos.push(s);
      if (halos.length >= 40) break;
    }
  }

  // the fair: bunting, stalls and lanterns round the notice stump
  let fairRoot: T.Group | null = null;
  function buildFair() {
    if (!game || fairRoot) return;
    fairRoot = new T.Group(); scene.add(fairRoot);
    const s = game.valley.stump;
    const flagCols = [0xe3577a, 0xf2c24a, 0x4f8fd6, 0x6eab4f, 0xf39a3a];
    const post = gg(new T.BoxGeometry(0.16, 2.6, 0.16)), postMat = mm(new T.MeshBasicMaterial({ color: 0x8a5a34 }));
    const flag = gg(new T.ConeGeometry(0.16, 0.34, 3)); flag.rotateX(Math.PI);
    const R = 5.2, n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, a2 = ((i + 1) / n) * Math.PI * 2;
      const px = s.x + 0.5 + Math.cos(a) * R, pz = s.z + 0.5 + Math.sin(a) * R, py = game.groundAt(px, pz, s.y + 2);
      const p = new T.Mesh(post, postMat); p.position.set(px, py + 1.3, pz); fairRoot.add(p);
      const qx = s.x + 0.5 + Math.cos(a2) * R, qz = s.z + 0.5 + Math.sin(a2) * R, qy = game.groundAt(qx, qz, s.y + 2);
      for (let k = 1; k < 7; k++) {
        const t = k / 7, f = new T.Mesh(flag, mm(new T.MeshBasicMaterial({ color: flagCols[(i + k) % flagCols.length] })));
        f.position.set(px + (qx - px) * t, py + 2.5 + (qy - py) * t - Math.sin(t * Math.PI) * 0.45, pz + (qz - pz) * t); fairRoot.add(f);
      }
      if (i % 2 === 0) { const l = new T.Sprite(glowMat); l.position.set(px, py + 2.7, pz); l.scale.setScalar(1.6); fairRoot.add(l); }
    }
    // two little striped stalls
    for (const [dx, dz, c] of [[-3.6, 3.2, 0xe3577a], [3.8, 3.4, 0x4f8fd6]] as [number, number, number][]) {
      const g = new T.Group(), x = s.x + 0.5 + dx, z = s.z + 0.5 + dz, y = game.groundAt(x, z, s.y + 2);
      const table = new T.Mesh(gg(new T.BoxGeometry(1.6, 0.7, 0.8)), mm(new T.MeshBasicMaterial({ color: 0xc99a5a }))); table.position.y = 0.35; g.add(table);
      for (let k = 0; k < 4; k++) { const st = new T.Mesh(gg(new T.BoxGeometry(0.4, 0.14, 1.0)), mm(new T.MeshBasicMaterial({ color: k % 2 ? 0xffffff : c }))); st.position.set(-0.6 + k * 0.4, 1.6, 0); g.add(st); }
      for (const ox of [-0.75, 0.75]) { const p = new T.Mesh(post, postMat); p.scale.y = 0.62; p.position.set(ox, 0.8, 0.35); g.add(p); }
      const tart = thing('tart'); tart.scale.setScalar(0.5); tart.position.set(-0.3, 0.72, 0); g.add(tart);
      const pot = thing('pot'); pot.scale.setScalar(0.5); pot.position.set(0.4, 0.72, 0); g.add(pot);
      g.position.set(x, y, z); g.lookAt(s.x + 0.5, y, s.z + 0.5); fairRoot.add(g);
    }
  }

  // ---------------------------------------------------------------- lighting at a point
  const L = { day: 1, sky: new T.Color(), lamp: new T.Color(1, 0.78, 0.46), amb: new T.Color(0.07, 0.07, 0.1) };
  function tintAt(m: T.MeshBasicMaterial, x: number, y: number, z: number, flash = 0) {
    if (!game) return;
    const w = game.world, X = Math.floor(x), Y = Math.floor(y + 0.4), Z = Math.floor(z);
    const sky = Math.pow(w.sky(X, Y, Z) / 15, 1.5) * L.day, lamp = Math.pow(w.lamp(X, Y, Z) / 15, 1.7) * (1 - 0.45 * L.day * (w.sky(X, Y, Z) / 15));
    const r = L.amb.r + sky * L.sky.r + lamp * L.lamp.r + 0.08, g = L.amb.g + sky * L.sky.g + lamp * L.lamp.g + 0.08, b = L.amb.b + sky * L.sky.b + lamp * L.lamp.b + 0.08;
    lin(m.color, Math.min(1.25, r) + flash, Math.min(1.25, g) + flash * 0.2, Math.min(1.25, b) + flash * 0.2);
  }

  // ---------------------------------------------------------------- animation
  function pose(r: Rig, b: Body, t: number, o: { speed: number; air: boolean; seed: number; happy?: number; look?: number }) {
    const p = r.parts, walk = Math.min(1, o.speed / 3.5), ph = b.walked * 3.2;
    const bob = Math.abs(Math.sin(ph)) * 0.07 * walk + Math.sin(t * 2 + o.seed) * 0.008;
    (p.inner as T.Object3D).position.y = bob + (o.happy ? Math.abs(Math.sin(t * 9)) * 0.18 * o.happy : 0);
    (p.inner as T.Object3D).rotation.z = Math.sin(ph) * 0.06 * walk;
    if (p.footL) { p.footL.rotation.x = Math.sin(ph) * 0.7 * walk; p.footR.rotation.x = -Math.sin(ph) * 0.7 * walk; }
    if (p.head) { p.head.rotation.x = -(o.look ?? 0) * 0.5 + Math.sin(t * 1.3 + o.seed) * 0.03; p.head.rotation.z = Math.sin(t * 0.7 + o.seed) * 0.04; }
    const wig = Math.max(0, Math.sin(t * 0.9 + o.seed * 3) - 0.92) * 6;
    if (p.earL) { p.earL.rotation.z = 0.12 + Math.sin(t * 14) * 0.25 * wig + (o.air ? 0.3 : 0); p.earR.rotation.z = -0.12 - Math.sin(t * 14 + 1) * 0.25 * wig - (o.air ? 0.3 : 0); }
    if (p.tail) { p.tail.rotation.y = Math.sin(t * 2.2 + o.seed) * 0.35 * (0.4 + walk); p.tail.rotation.x = Math.sin(ph * 2) * 0.12 * walk; }
  }
  const npcSpeed = new Map<string, { x: number; z: number; v: number }>();
  const speedOf = (key: string, b: Body, dt: number) => {
    const s = npcSpeed.get(key) ?? { x: b.x, z: b.z, v: 0 };
    const v = dt > 0 ? Math.hypot(b.x - s.x, b.z - s.z) / dt : 0;
    s.v += (v - s.v) * Math.min(1, dt * 10); s.x = b.x; s.z = b.z; npcSpeed.set(key, s); return s.v;
  };

  // ---------------------------------------------------------------- events from the game
  function feed(evs: Ev[]) {
    if (!game) return;
    for (const e of evs) {
      const x = (e.x ?? 0), y = (e.y ?? 0), z = (e.z ?? 0);
      switch (e.t) {
        case 'dig': burst(x + 0.5, y + 0.5, z + 0.5, tileCol(e.b ?? 0), 14, { speed: 2.4, up: 3.5 }); break;
        case 'chip': burst(x + 0.5, y + 0.5, z + 0.5, tileCol(e.b ?? 0), 3, { speed: 1.4, up: 2, size: 0.08 }); break;
        case 'place': burst(x + 0.5, y + 0.05, z + 0.5, tileCol(e.b ?? 0), 6, { speed: 1.2, up: 1, size: 0.08, life: 0.4 }); break;
        case 'hit': burst(x, y + 0.5, z, [1, 0.95, 0.7], 8, { speed: 3, up: 2, size: 0.08, life: 0.35, grav: 4 }); break;
        case 'defeat': burst(x, y + 0.4, z, PUFF, 26, { speed: 2.4, up: 2.5, size: 0.2, life: 0.8, grav: -1 }); burst(x, y + 0.4, z, [1, 0.85, 0.4], 10, { speed: 3, up: 3, size: 0.07, life: 0.6 }); break;
        case 'catch': case 'poof': burst(x, y + 0.3, z, PUFF, 16, { speed: 1.8, up: 1.5, size: 0.17, life: 0.6, grav: -1 }); break;
        case 'leaf': burst(x + 0.5, y + 0.6, z + 0.5, [1, 0.85, 0.3], 22, { speed: 2, up: 3, size: 0.07, life: 1, grav: 2 }); break;
        case 'snuff': burst(x + 0.5, y + 0.7, z + 0.5, [0.35, 0.33, 0.4], 12, { speed: 0.8, up: 1.5, size: 0.12, life: 1, grav: -2 }); haloScan = 0; break;
        case 'relight': burst(x + 0.5, y + 0.5, z + 0.5, [1, 0.85, 0.4], 10, { speed: 1, up: 1.5, size: 0.06, life: 0.6, grav: 0 }); haloScan = 0; break;
        case 'knock': burst(x + 0.5, y + 0.3, z + 0.5, tileCol(e.b ?? 0), 8, { speed: 1.5, up: 2 }); break;
        case 'hurt': burst(x, y + 0.6, z, [1, 0.45, 0.5], 8, { speed: 2, up: 2, size: 0.08, life: 0.4 }); break;
        case 'thud': burst(x, y + 0.5, z, [0.9, 0.85, 0.7], 10, { speed: 2, up: 2.5, size: 0.1 }); break;
        case 'movein': case 'fair': burst(game.me.x, game.me.y + 1, game.me.z, [1, 0.8, 0.4], 30, { speed: 3, up: 5, size: 0.08, life: 1.2, grav: 6 }); break;
        case 'splash': burst(x + 0.5, y + 0.9, z + 0.5, [0.5, 0.75, 0.95], 12, { speed: 1.5, up: 3 }); break;
        case 'grow': burst(x + 0.5, y + 1, z + 0.5, [0.5, 0.85, 0.4], 24, { speed: 2, up: 3, size: 0.1, life: 0.9 }); break;
        case 'land': burst(game.me.x, game.me.y + 0.05, game.me.z, PUFF, 6, { speed: 1.2, up: 0.6, size: 0.08, life: 0.35, grav: 0 }); break;
      }
      if (e.t === 'place' && e.b !== undefined && BLOCKS[e.b].light) haloScan = 0;
      if (e.t === 'dig' && e.b !== undefined && BLOCKS[e.b].light) haloScan = 0;
    }
  }

  // ---------------------------------------------------------------- the frame
  const box3 = new T.Box3(), v3 = new T.Vector3();
  let camLook = new T.Vector3(), camPos = new T.Vector3(), camInit = false;
  let camDebug = { dist: 0, hit: '', hx: 0, hy: 0, hz: 0 };
  function frame(dt: number, view: View) {
    if (!game || closed) return;
    time += dt;
    const g = game, me = g.me, ph = phaseOf(g.time);
    // the day: sky colours, light, fog
    const day = daylight(ph), dusk = Math.max(0, 1 - Math.abs(ph - 0.64) / 0.07), dawn = Math.max(0, 1 - Math.abs(ph - 0.975) / 0.03), night = 1 - day;
    L.day = 0.12 + day * 0.88;
    const warm = Math.max(dusk, dawn);
    lin(L.sky, 1 - night * 0.55 + warm * 0.05, 0.98 - night * 0.45 - warm * 0.2, 0.92 - night * 0.05 - warm * 0.35);
    uniforms.uDay.value = L.day; (uniforms.uSky.value as T.Color).copy(L.sky);
    const top = new T.Color(), hor = new T.Color();
    lin(top, 0.36 * day + 0.03, 0.62 * day + 0.04, 0.98 * day + 0.12); lin(hor, 0.78 * day + 0.1 + warm * 0.4, 0.88 * day + 0.12 + warm * 0.1, 0.98 * day + 0.2 - warm * 0.2);
    const under = me.y < 14 && g.world.sky(Math.floor(me.x), Math.floor(me.y + 0.7), Math.floor(me.z)) < 4;
    (skyMat.uniforms.uTop.value as T.Color).copy(top); (skyMat.uniforms.uHor.value as T.Color).copy(hor);
    (skyMat.uniforms.uSun.value as T.Vector3).set(Math.sin(ph * Math.PI * 2 + 0.6), Math.cos((ph - 0.3) * Math.PI * 2) , 0.4).normalize();
    skyMat.uniforms.uNight.value = night;
    starMat.opacity = Math.max(0, night - 0.3) * 1.2;
    (uniforms.uFog.value as T.Color).copy(under ? lin(new T.Color(), 0.04, 0.04, 0.07) : hor);
    uniforms.uFogNear.value = under ? 10 : phone ? 34 : 46; uniforms.uFogFar.value = under ? 34 : phone ? 72 : 96;
    uniforms.uTime.value = time;
    syncUniforms();
    scene.background = null;
    clouds.children.forEach((c, i) => { c.position.x += dt * (0.6 + (i % 3) * 0.2); if (c.position.x > W + 70) c.position.x = -70; });
    (cloudMat.color as T.Color).setRGB(0.55 + day * 0.45 + warm * 0.2, 0.55 + day * 0.45, 0.62 + day * 0.38 - warm * 0.2, T.LinearSRGBColorSpace);
    cloudMat.opacity = 0.35 + day * 0.55;

    rebuild(builtOnce.size < allKeys.length ? 40 : 7);

    // Dora and Enzo
    g.players.forEach((b, i) => {
      const r = chin[i], active = i === g.who;
      r.root.position.set(b.x, b.y, b.z);
      r.root.rotation.y = b.yaw;
      const sp = speedOf('p' + i, b, dt);
      pose(r, b, time, { speed: sp, air: !b.ground && !b.water, seed: i * 2.1, look: active ? b.pitch : 0, happy: g.fair ? 1 : 0 });
      if (b.water) r.root.position.y -= 0.25;
      const flash = active && g.hurtT > 0.5 ? (g.hurtT - 0.5) * 1.2 : 0;
      tintAt(r.mats[0], b.x, b.y, b.z, flash);
      // hidden in first person, and when the camera is pressed right up against them (backed into a wall)
      const close = camInit && !view.orbit && Math.hypot(camPos.x - b.x, camPos.y - b.y - 0.45, camPos.z - b.z) < 0.85;
      r.root.visible = !(active && view.mode === 'first' && !view.orbit) && !close;
    });
    // the held tool
    if (view.held !== heldKey) {
      if (heldObj) fpHand.remove(heldObj);
      if (tpHeld) tpHeld.parent?.remove(tpHeld);
      heldObj = null; tpHeld = null; heldKey = view.held;
      if (view.held) {
        heldObj = thing(view.held); heldObj.scale.setScalar(ITEMS[view.held]?.block !== null ? 0.32 : 0.55); heldObj.rotation.set(0.2, -0.6, 0.1); fpHand.add(heldObj);
        tpHeld = thing(view.held); tpHeld.scale.setScalar(ITEMS[view.held]?.block !== null ? 0.22 : 0.4);
      }
    }
    if (tpHeld) { const r = chin[g.who]; if (tpHeld.parent !== r.parts.inner) r.parts.inner.add(tpHeld); tpHeld.position.set(0.2, 0.34, -0.3); tpHeld.rotation.set(-0.3 - Math.max(0, 0.3 - view.swing) * 4, 0, 0.2); }
    const sw = Math.max(0, 0.3 - view.swing) / 0.3;
    fpHand.position.set(0.42, -0.38 - Math.sin(sw * Math.PI) * 0.06 + Math.abs(Math.sin(me.walked * 3.2)) * 0.02, -0.7 + Math.sin(sw * Math.PI) * 0.1);
    fpHand.rotation.x = -Math.sin(sw * Math.PI) * 0.9;
    fpHand.visible = view.mode === 'first' && !view.orbit && !view.menu;
    if (heldObj) for (const m of [itemMat]) tintAt(m, me.x, me.y, me.z);

    // neighbours
    for (const n of g.npcs) {
      let r = npcRigs.get(n.who);
      if (!r) { r = rig(neighbour(n.who)); npcRigs.set(n.who, r); scene.add(r.root); }
      r.root.position.set(n.body.x, n.body.y, n.body.z); r.root.rotation.y = n.body.yaw;
      pose(r, n.body, time, { speed: speedOf(n.who, n.body, dt), air: false, seed: n.who.length * 1.7, happy: g.fair ? 0.8 : n.st === 'visit' && g.ready() ? 0.35 : 0 });
      tintAt(r.mats[0], n.body.x, n.body.y, n.body.z);
    }
    for (const [who, r] of npcRigs) if (!g.npcs.some((n) => n.who === who)) { scene.remove(r.root); npcRigs.delete(who); }

    // creatures
    const live = new Set<number>();
    for (const c of g.critters) {
      live.add(c.id);
      let r = critterRigs.get(c.id);
      if (!r) { r = { ...rig(critter(c.kind), c.kind === 'boar' ? 1.05 : 1), kind: c.kind, seen: 0 }; critterRigs.set(c.id, r); scene.add(r.root); }
      r.seen += dt;
      animateCritter(r, c, dt);
    }
    for (const [id, r] of critterRigs) if (!live.has(id)) { scene.remove(r.root); critterRigs.delete(id); }

    // pick-ups and leaves
    const pl = new Set<number>();
    for (const p of g.pickups) {
      pl.add(p.id);
      let o = pickMeshes.get(p.id);
      if (!o) { const keys = Object.keys(p.items); o = thing(keys.length > 1 ? 'bundle' : keys[0]); o.scale.setScalar(ITEMS[keys[0]]?.block !== null && keys.length === 1 ? 0.3 : 0.5); pickRoot.add(o); pickMeshes.set(p.id, o); }
      o.position.set(p.x, p.y + 0.1 + Math.sin(time * 3 + p.id) * 0.08, p.z); o.rotation.y = time * 1.6 + p.id;
    }
    for (const [id, o] of pickMeshes) if (!pl.has(id)) { pickRoot.remove(o); pickMeshes.delete(id); }
    if (leafMeshes.length !== g.valley.leaves.length) { leafMeshes = g.valley.leaves.map((l) => { const o = thing('leaf'); o.scale.setScalar(0.7); o.position.set(l.x + 0.5, l.y + 0.35, l.z + 0.5); leafRoot.add(o); const s = new T.Sprite(glowMat); s.scale.setScalar(1.2); s.position.y = 0.4; o.add(s); return o; }); }
    leafMeshes.forEach((o, i) => { if (!o) return; o.visible = !g.leavesTaken[i] && !g.creative; o.rotation.y = time * 1.4 + i; o.position.y = g.valley.leaves[i].y + 0.35 + Math.sin(time * 2 + i) * 0.1; });
    tintAt(itemMat, me.x, me.y, me.z); itemMat.color.multiplyScalar(1); lin(itemMat.color, Math.max(itemMat.color.r, 0.55), Math.max(itemMat.color.g, 0.55), Math.max(itemMat.color.b, 0.55));
    // shots
    while (shotRoot.children.length < g.shots.length) shotRoot.add(new T.Mesh(shotGeo, shotMat));
    shotRoot.children.forEach((o, i) => { const s = g.shots[i]; o.visible = !!s; if (s) o.position.set(s.x, s.y, s.z); });

    // aim outline, crack and ghost
    if (view.aim) { outline.visible = true; outline.position.set(view.aim.x + 0.5, view.aim.y + 0.5, view.aim.z + 0.5); } else outline.visible = false;
    if (view.aim && view.dig > 0 && view.dig < 1) { crack.visible = true; crack.position.copy(outline.position); crackTex.offset.x = Math.min(3, Math.floor(view.dig * 4)) * 0.25; } else crack.visible = false;
    if (view.ghost) { ghost.visible = true; ghost.position.set(view.ghost.x + 0.5, view.ghost.y + 0.5, view.ghost.z + 0.5); (ghost.material as T.MeshBasicMaterial).opacity = 0.16 + Math.sin(time * 5) * 0.05; } else ghost.visible = false;

    // particles
    let n = 0;
    for (let i = plist.length - 1; i >= 0; i--) {
      const p = plist[i]; p.life += dt;
      if (p.life >= p.max) { plist.splice(i, 1); continue; }
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 1 - dt * 2; p.vz *= 1 - dt * 2;
      const s = p.s * (1 - (p.life / p.max) * 0.6);
      tmpM.compose(tmpP.set(p.x, p.y, p.z), tmpQ, tmpS.set(s, s, s)); parts.setMatrixAt(n, tmpM); parts.setColorAt(n, tmpC.copy(p.c)); n++;
    }
    parts.count = n; parts.instanceMatrix.needsUpdate = true; if (parts.instanceColor) parts.instanceColor.needsUpdate = true;
    pMat.color.setRGB(Math.min(1, L.day + 0.35), Math.min(1, L.day + 0.35), Math.min(1, L.day + 0.4), T.LinearSRGBColorSpace);

    // fireflies at night, lantern halos
    const ffOn = night > 0.4 && !under;
    ffMat.opacity += ((ffOn ? 0.9 : 0) - ffMat.opacity) * Math.min(1, dt * 1.5);
    if (ffMat.opacity > 0.02) {
      const a = ffGeo.attributes.position as T.BufferAttribute;
      for (let i = 0; i < FF; i++) {
        const bx = Math.floor(me.x / 24) * 24 + hash3(7, i, 0, 0) * 40 - 8, bz = Math.floor(me.z / 24) * 24 + hash3(7, i, 1, 0) * 40 - 8;
        const fx = bx + Math.sin(time * 0.4 + i) * 1.5, fz = bz + Math.cos(time * 0.33 + i * 2) * 1.5;
        const gy = g.groundAt(fx, fz, H - 3);
        a.setXYZ(i, fx, gy + 0.8 + Math.sin(time * 0.9 + i * 3) * 0.5 + hash3(7, i, 2, 0) * 1.6, fz);
      }
      a.needsUpdate = true;
    }
    haloScan -= dt; if (haloScan <= 0) { haloScan = 1.2; scanHalos(); }
    const halo = 0.25 + night * 0.75;
    glowMat.opacity = halo * (0.85 + Math.sin(time * 3) * 0.05); cyanMat.opacity = 0.7;

    // the fair
    if (g.fair) buildFair();

    // the camera
    const e = { x: me.x, y: me.y + BODY.eye, z: me.z };
    const dir = new T.Vector3(-Math.sin(me.yaw) * Math.cos(me.pitch), Math.sin(me.pitch), -Math.cos(me.yaw) * Math.cos(me.pitch));
    let want: T.Vector3, look: T.Vector3;
    if (view.orbit) {
      const o = view.orbit, a = o.t * 0.22 + 0.6;
      want = new T.Vector3(o.x + Math.cos(a) * 9.5, o.y + 4.2, o.z + Math.sin(a) * 9.5);
      look = new T.Vector3(o.x, o.y + 0.8, o.z);
    } else if (view.mode === 'first') {
      want = new T.Vector3(e.x, e.y, e.z); look = want.clone().add(dir);
    } else {
      const head = new T.Vector3(me.x, me.y + 0.78, me.z);
      let dist = 2.9;
      const hit = g.world.raycast(head.x, head.y, head.z, -dir.x, -dir.y + 0.18, -dir.z, dist + 0.3, true); // grass and flowers don't push the camera in
      if (hit) dist = Math.max(0.6, hit.dist - 0.3);
      camDebug = { dist, hit: hit ? BLOCKS[hit.b].key : '', hx: hit?.x ?? 0, hy: hit?.y ?? 0, hz: hit?.z ?? 0 };
      want = head.clone().addScaledVector(dir, -dist).add(new T.Vector3(0, 0.18 * dist / 2.9, 0));
      look = head.clone().addScaledVector(dir, 4);
    }
    if (!camInit || view.mode === 'first' || view.orbit) { camPos.copy(want); camLook.copy(look); camInit = true; }
    else { camPos.lerp(want, Math.min(1, dt * 18)); camLook.lerp(look, Math.min(1, dt * 24)); }
    camera.position.copy(camPos); camera.lookAt(camLook);
    sky.position.copy(camera.position); stars.position.copy(camera.position);
    renderer.render(scene, camera);
  }

  function animateCritter(r: Rig & { kind: CritterKind; seen: number }, c: Critter, dt: number) {
    const b = c.body, p = r.parts, t = time + c.seed % 100;
    r.root.position.set(b.x, b.y, b.z); r.root.rotation.y = b.yaw;
    const inner = p.inner;
    const appear = Math.min(1, r.seen * 3);
    inner.scale.setScalar((r.kind === 'boar' ? 1.05 : 1) * appear * (c.hurt > 0 ? 1 + c.hurt * 0.6 : 1));
    const sp = Math.hypot(b.vx, b.vz);
    let flash = c.hurt > 0 ? 0.8 : 0;
    switch (r.kind) {
      case 'bunny': case 'grumble': {
        const hop = Math.abs(Math.sin(t * (r.kind === 'grumble' ? 11 : 8))) * Math.min(1, sp / 2) * 0.28;
        inner.position.y = hop; inner.scale.y *= 1 - hop * 0.6 + 0.1 * Math.min(1, sp);
        if (p.a) { p.a.rotation.z = 0.2 + Math.sin(t * 6) * 0.2; p.b.rotation.z = -0.2 - Math.sin(t * 6 + 1) * 0.2; }
        break;
      }
      case 'boar': {
        const wind = c.st === 'windup', stun = c.st === 'stun', charge = c.st === 'charge';
        inner.position.x = wind ? Math.sin(t * 40) * 0.04 : 0;
        inner.rotation.x = wind ? 0.12 : charge ? -0.08 : 0;
        const ph = b.walked * 4;
        p.a.rotation.x = wind ? Math.sin(t * 18) * 0.8 : Math.sin(ph) * 0.6; p.b.rotation.x = wind ? 0 : -Math.sin(ph) * 0.6; p.c.rotation.x = -Math.sin(ph) * 0.5;
        inner.rotation.z = stun ? Math.sin(t * 6) * 0.15 : 0;
        if (wind) flash = Math.max(flash, 0.3 + Math.sin(t * 20) * 0.3);
        if (stun) { if (!r.extra) { r.extra = dizzy(); r.root.add(r.extra); } r.extra.visible = true; r.extra.rotation.y = t * 5; }
        else if (r.extra) r.extra.visible = false;
        break;
      }
      case 'moth': {
        const f = Math.sin(t * (c.st === 'swoop' ? 30 : 20));
        p.a.rotation.z = f * 0.7; p.b.rotation.z = -f * 0.7;
        inner.rotation.x = c.st === 'swoop' ? 0.5 : 0;
        break;
      }
      case 'gnasher': {
        const open = c.st === 'lunge' || c.st === 'chase' ? 0.5 + Math.sin(t * 16) * 0.35 : c.st === 'lurk' ? 0 : 0.15;
        p.a.rotation.x = -open * 0;
        p.body.rotation.x = -open * 0.5;
        inner.position.y = c.st === 'lurk' ? 0 : Math.abs(Math.sin(t * 9)) * 0.08;
        break;
      }
    }
    tintAt(r.mats[0], b.x, b.y, b.z, flash);
    if (r.kind === 'gnasher' && c.st === 'lurk') r.mats[0].color.multiplyScalar(0.85);
  }
  function dizzy() {
    const g = new T.Group(), m = mm(new T.MeshBasicMaterial({ color: 0xffe066 }));
    for (let i = 0; i < 3; i++) { const s = new T.Mesh(gg(new T.OctahedronGeometry(0.08)), m); const a = (i / 3) * Math.PI * 2; s.position.set(Math.cos(a) * 0.35, 1.05, Math.sin(a) * 0.35); g.add(s); }
    return g;
  }

  // ---------------------------------------------------------------- icons
  /** Renders every item to a small picture (data URL) with a separate little renderer, once. */
  function icons(keys: string[], size = 64): Record<string, string> {
    const out: Record<string, string> = {};
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    let r: T.WebGLRenderer | null = null;
    try { r = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch { return out; }
    r.outputColorSpace = T.LinearSRGBColorSpace; r.setClearColor(0x000000, 0);
    const sc = new T.Scene(), cam = new T.OrthographicCamera(-0.8, 0.8, 0.8, -0.8, 0.1, 10);
    cam.position.set(2.2, 1.9, 2.2); cam.lookAt(0, 0.45, 0);
    const save = { day: uniforms.uDay.value, fogN: uniforms.uFogNear.value, fogF: uniforms.uFogFar.value };
    uniforms.uDay.value = 1; (uniforms.uSky.value as T.Color).setRGB(1, 1, 1, T.LinearSRGBColorSpace); uniforms.uFogNear.value = 1000; uniforms.uFogFar.value = 2000; syncUniforms();
    lin(itemMat.color, 1, 1, 1);
    for (const k of keys) {
      const o = thing(k);
      const bb = new T.Box3().setFromObject(o), sz = bb.getSize(new T.Vector3()), c = bb.getCenter(new T.Vector3());
      const s = 1.05 / Math.max(sz.x, sz.y, sz.z, 0.3);
      o.scale.setScalar(s); o.position.set(-c.x * s, -c.y * s + 0.45, -c.z * s);
      if (k.includes(':')) o.rotation.y = Math.PI * 0.25 + Math.PI; else if (ITEMS[k]?.block === null || prop(k)) o.rotation.y = -0.5;
      sc.add(o); r.render(sc, cam); out[k] = cv.toDataURL('image/png'); sc.remove(o);
    }
    uniforms.uDay.value = save.day; uniforms.uFogNear.value = save.fogN; uniforms.uFogFar.value = save.fogF; syncUniforms();
    r.dispose(); r.forceContextLoss();
    return out;
  }

  // ---------------------------------------------------------------- framing for the tests
  /** Where Dora and Enzo are on screen (CSS pixels), for the framing checks. */
  function boxes() {
    const rect = canvas.getBoundingClientRect();
    const of = (o: T.Object3D): Box => {
      if (!o.visible) return { x: 0, y: 0, w: 0, h: 0, on: false };
      box3.setFromObject(o);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, front = false;
      for (let i = 0; i < 8; i++) {
        v3.set(i & 1 ? box3.max.x : box3.min.x, i & 2 ? box3.max.y : box3.min.y, i & 4 ? box3.max.z : box3.min.z).project(camera);
        if (v3.z < 1) front = true;
        const sx = (v3.x * 0.5 + 0.5) * rect.width, sy = (-v3.y * 0.5 + 0.5) * rect.height;
        x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, on: front };
    };
    const nb: Record<string, Box> = {};
    for (const [k, r] of npcRigs) nb[k] = of(r.root);
    const cr = game ? game.critters.map((c) => {
      const r = critterRigs.get(c.id), me = game!.me;
      return { kind: c.kind, box: r ? of(r.root) : { x: 0, y: 0, w: 0, h: 0, on: false }, yaw: c.body.yaw, toPlayer: Math.atan2(-(me.x - c.body.x), -(me.z - c.body.z)) };
    }) : [];
    return { dora: of(chin[0].root), enzo: of(chin[1].root), neighbours: nb, critters: cr, cam: { ...camDebug, at: camPos.toArray(), me: game ? [game.me.x, game.me.y, game.me.z] : [] } };
  }

  function resize() {
    const r = canvas.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 78 : 70; camera.updateProjectionMatrix();
  }
  function setGame(g: CubbyGame) {
    game = g;
    for (const [, ms] of chunks) for (const m of ms) { chunkRoot.remove(m); m.geometry.dispose(); geos.delete(m.geometry as T.BufferGeometry); }
    chunks.clear(); builtOnce = new Set();
    for (const k of allKeys) g.world.dirty.add(k);
    for (const [, r] of critterRigs) scene.remove(r.root); critterRigs.clear();
    for (const [, r] of npcRigs) scene.remove(r.root); npcRigs.clear();
    for (const [, o] of pickMeshes) pickRoot.remove(o); pickMeshes.clear();
    for (const o of leafMeshes) if (o) leafRoot.remove(o); leafMeshes = [];
    if (fairRoot) { scene.remove(fairRoot); fairRoot = null; }
    plist.length = 0; camInit = false; haloScan = 0;
  }
  /** Meshes chunks for up to `ms` milliseconds; returns how much of the valley is built (0–1). */
  function preload(ms: number) { if (game) rebuild(ms); return builtOnce.size / allKeys.length; }
  function dispose() {
    closed = true;
    for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const t of texs) t.dispose();
    renderer.dispose(); renderer.forceContextLoss();
  }
  return { setGame, preload, frame, feed, resize, icons, boxes, dispose, get camera() { return camera; }, get atlas() { return atlasCanvas; } };
}
