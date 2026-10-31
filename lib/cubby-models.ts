// Cubby Valley's voxel toys: a tiny model format (a palette and a set of little cubes, in named parts that animate),
// the mesher that turns a model into coloured quads with soft corner shading, and every model in the game — Dora and
// Enzo, the six neighbours, the dust-bunnies and the night's monsters, the furniture and the items. Sixteen voxels make
// one block. Models face -z (the way a body with yaw 0 walks). DOM-free.
import type { CritterKind, NeighbourId } from './cubby-content.js';

export type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const K = (x: number, y: number, z: number) => ((x + 128) | ((y + 128) << 8) | ((z + 128) << 16));
const UK = (k: number): [number, number, number] => [(k & 255) - 128, ((k >> 8) & 255) - 128, ((k >> 16) & 255) - 128];

/** A voxel builder: colours by name, shapes by inclusive integer boxes and ellipsoids. */
export class Vox {
  cells = new Map<number, string>();
  set(x: number, y: number, z: number, c: string) { this.cells.set(K(x, y, z), c); return this; }
  get(x: number, y: number, z: number) { return this.cells.get(K(x, y, z)); }
  del(x: number, y: number, z: number) { this.cells.delete(K(x, y, z)); return this; }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: string) {
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, z, c);
    return this;
  }
  ell(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: string, keep?: (x: number, y: number, z: number) => boolean) {
    for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const q = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + ((z + 0.5 - cz) / rz) ** 2;
      if (q <= 1 && (!keep || keep(x, y, z))) this.set(x, y, z, c);
    }
    return this;
  }
  /** Recolours the front-most voxel (smallest z) in a column. */
  front(x: number, y: number, c: string, depth = 0) {
    let best: number | null = null;
    for (const k of this.cells.keys()) { const [X, Y, Z] = UK(k); if (X === x && Y === y && (best === null || Z < best)) best = Z; }
    if (best !== null) for (let d = 0; d <= depth; d++) if (this.get(x, y, best + d)) this.set(x, y, best + d, c);
    return best;
  }
  /** Recolours every voxel that passes a test. */
  paint(test: (x: number, y: number, z: number, c: string) => boolean, c: string) {
    for (const [k, v] of this.cells) { const [x, y, z] = UK(k); if (test(x, y, z, v)) this.cells.set(k, c); }
    return this;
  }
  mirrorX(fromSide = -1) {
    for (const [k, v] of [...this.cells]) { const [x, y, z] = UK(k); if (Math.sign(x + 0.5) === fromSide) this.set(-x - 1, y, z, v); }
    return this;
  }
}
export interface Part { name: string; vox: Vox; pivot: [number, number, number] }
export interface Model { name: string; colours: Record<string, string>; parts: Part[] }
export interface MeshData { pos: Float32Array; col: Float32Array; index: Uint32Array }

const SHADE = { top: 1, bottom: 0.6, x: 0.8, z: 0.9 };
const AO = [0.52, 0.7, 0.86, 1];
const DIRS: { n: [number, number, number]; u: [number, number, number]; v: [number, number, number]; s: number }[] = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], s: SHADE.x }, { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], s: SHADE.x },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], s: SHADE.top }, { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], s: SHADE.bottom },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], s: SHADE.z }, { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], s: SHADE.z },
];
/** A tiny hash for a hand-painted wobble in each voxel's colour. */
const jit = (x: number, y: number, z: number) => { let h = Math.imul(x * 73856093 ^ y * 19349663 ^ z * 83492791, 0x9e3779b1); h ^= h >>> 15; return ((h >>> 0) % 1000) / 1000 - 0.5; };

/** Meshes one voxel set: faces only where the neighbour is empty, each corner darkened by its neighbours. */
export function meshVox(v: Vox, colours: Record<string, string>, scale: number, origin: [number, number, number] = [0, 0, 0]): MeshData {
  const pos: number[] = [], col: number[] = [], index: number[] = [];
  const rgb: Record<string, RGB> = {};
  for (const [n, h] of Object.entries(colours)) rgb[n] = hex(h);
  const has = (x: number, y: number, z: number) => v.cells.has(K(x, y, z));
  for (const [k, c] of v.cells) {
    const [x, y, z] = UK(k), base = rgb[c] ?? [1, 0, 1], j = 1 + jit(x, y, z) * 0.07;
    for (const d of DIRS) {
      const [nx, ny, nz] = d.n;
      if (has(x + nx, y + ny, z + nz)) continue;
      const [ux, uy, uz] = d.u, [vx, vy, vz] = d.v;
      // the face's corner at (0,0) of its u/v square sits on the +n side of the voxel
      const ox = x + (nx > 0 ? 1 : 0), oy = y + (ny > 0 ? 1 : 0), oz = z + (nz > 0 ? 1 : 0);
      const start = pos.length / 3, aos: number[] = [];
      for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const px = ox + ux * a + vx * b, py = oy + uy * a + vy * b, pz = oz + uz * a + vz * b;
        pos.push((px + origin[0]) * scale, (py + origin[1]) * scale, (pz + origin[2]) * scale);
        const su = a ? 1 : -1, sv = b ? 1 : -1;
        const s1 = has(x + nx + ux * su, y + ny + uy * su, z + nz + uz * su) ? 1 : 0;
        const s2 = has(x + nx + vx * sv, y + ny + vy * sv, z + nz + vz * sv) ? 1 : 0;
        const cc = has(x + nx + ux * su + vx * sv, y + ny + uy * su + vy * sv, z + nz + uz * su + vz * sv) ? 1 : 0;
        const ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
        aos.push(ao);
        const f = AO[ao] * d.s * j;
        col.push(base[0] * f, base[1] * f, base[2] * f);
      }
      if (aos[0] + aos[2] >= aos[1] + aos[3]) index.push(start, start + 1, start + 2, start, start + 2, start + 3);
      else index.push(start + 1, start + 2, start + 3, start + 1, start + 3, start);
    }
  }
  return { pos: Float32Array.from(pos), col: Float32Array.from(col), index: Uint32Array.from(index) };
}
export function meshPart(m: Model, p: Part, scale = 1 / 16) {
  return meshVox(p.vox, m.colours, scale, [-p.pivot[0], -p.pivot[1], -p.pivot[2]]);
}
/** All parts of a model merged into one mesh (for props and icons). */
export function meshModel(m: Model, scale = 1 / 16, origin: [number, number, number] = [0, 0, 0]): MeshData {
  const all = new Vox();
  for (const p of m.parts) for (const [k, c] of p.vox.cells) all.cells.set(k, c);
  return meshVox(all, m.colours, scale, origin);
}

// ---------------------------------------------------------------- chinchillas
export type Who = 'dora' | 'enzo';
const CHIN: Record<Who, Record<string, string>> = {
  dora: { fur: '#f4ede2', back: '#e6dccd', chest: '#fffaf3', eye: '#b3132e', glint: '#ffffff', ear: '#f5a7b8', rim: '#ece2d3', nose: '#eb8ea4', cheek: '#f7c4cd', paw: '#f8e8e4', tail: '#efe6d8', tip: '#ffffff' },
  enzo: { fur: '#8f9cae', back: '#77849a', chest: '#d9dee6', eye: '#141519', glint: '#ffffff', ear: '#f3a2b3', rim: '#8794a7', nose: '#e690a5', cheek: '#c9a9b8', paw: '#c8cfda', tail: '#8794a7', tip: '#b9c2cf' },
};
/**
 * A chinchilla toy, sitting up: a round body with a pale chest, a big head with a broad, slightly flat, smooth crown,
 * round pink ears set at the sides of the crown (the only thing on the head), ruby or black eyes with a glint, paws,
 * feet and a fluffy curled tail. Parts: body, head, earL, earR, footL, footR, tail.
 */
export function chinchilla(who: Who): Model {
  const body = new Vox(), head = new Vox(), earL = new Vox(), earR = new Vox(), footL = new Vox(), footR = new Vox(), tail = new Vox();
  body.ell(0, 4.6, 0.6, 4.6, 4.8, 4.1, 'fur');
  body.paint((x, y, z) => z >= 2 && y >= 3, 'back');
  body.paint((x, y, z) => z <= -2 && Math.abs(x + 0.5) <= 2.6 && y >= 2 && y <= 7, 'chest');
  body.box(-3, 5, -4, -2, 6, -3, 'paw').box(1, 5, -4, 2, 6, -3, 'paw');
  // the head: wide and a little flat on top, a smooth rounded crown
  head.ell(0, 10.2, -0.4, 5.1, 4.0, 4.4, 'fur', (x, y) => y <= 13);
  head.paint((x, y, z) => z >= 2 && y >= 11, 'back');
  for (const ex of [-3, 2]) {
    head.front(ex, 10, 'eye'); head.front(ex + 1, 10, 'eye'); head.front(ex, 11, 'eye'); head.front(ex + 1, 11, 'eye');
    head.front(ex < 0 ? ex : ex + 1, 11, 'glint');
  }
  head.front(0, 9, 'nose'); head.front(-1, 9, 'nose');
  head.front(-4, 9, 'cheek'); head.front(3, 9, 'cheek');
  head.front(-1, 8, 'chest'); head.front(0, 8, 'chest');
  // round ears at the sides of the crown, pink inside
  const ear = (v: Vox, cx: number) => {
    v.ell(cx, 13.4, 0.5, 2.6, 2.9, 0.9, 'rim');
    v.paint((x, y, z) => z <= 0 && ((x + 0.5 - cx) / 1.9) ** 2 + ((y + 0.5 - 13.4) / 2.2) ** 2 <= 1, 'ear');
  };
  ear(earL, -4.6); ear(earR, 4.6);
  footL.box(-3, 0, -3, -1, 0, 0, 'paw'); footR.box(1, 0, -3, 2, 0, 0, 'paw');
  footL.box(-3, 0, -3, -2, 1, -2, 'paw'); footR.box(1, 0, -3, 2, 1, -2, 'paw');
  // a big soft tail curling up the back
  tail.ell(0, 3.2, 5.4, 2.4, 2.4, 2.2, 'tail').ell(0, 6.2, 6.6, 2.2, 2.8, 2, 'tail').ell(0, 8.8, 6.2, 1.8, 1.6, 1.6, 'tip');
  return {
    name: who, colours: CHIN[who], parts: [
      { name: 'body', vox: body, pivot: [0, 0, 0] }, { name: 'head', vox: head, pivot: [0, 7.5, 0] },
      { name: 'earL', vox: earL, pivot: [-3.5, 12, 0.5] }, { name: 'earR', vox: earR, pivot: [3.5, 12, 0.5] },
      { name: 'footL', vox: footL, pivot: [-1.5, 1, -1] }, { name: 'footR', vox: footR, pivot: [1.5, 1, -1] },
      { name: 'tail', vox: tail, pivot: [0, 2.5, 4.5] },
    ],
  };
}

// ---------------------------------------------------------------- neighbours
/** A friendly animal toy built on the same sitting-up plan, with its own colours and features. */
export function neighbour(id: NeighbourId): Model {
  const body = new Vox(), head = new Vox(), earL = new Vox(), earR = new Vox(), footL = new Vox(), footR = new Vox(), tail = new Vox();
  const eyes = (v: Vox, y: number, spread = 2, c = 'eye') => { for (const ex of [-spread - 1, spread]) { v.front(ex, y, c); v.front(ex + 1, y, c); v.front(ex, y + 1, c); v.front(ex + 1, y + 1, c); v.front(ex < 0 ? ex : ex + 1, y + 1, 'glint'); } };
  let colours: Record<string, string> = {};
  footL.box(-3, 0, -3, -1, 0, 0, 'foot'); footR.box(1, 0, -3, 2, 0, 0, 'foot');
  switch (id) {
    case 'hazel': // hedgehog baker: spiny back, cream face, white apron
      colours = { fur: '#d9b48a', spine: '#6b4a2e', tip: '#c9a27a', face: '#f1dcc0', eye: '#1b1412', glint: '#ffffff', nose: '#2a1d18', apron: '#fbf6ee', strap: '#e48aa0', foot: '#c79b70', ear: '#e6a58f' };
      body.ell(0, 4.6, 0.6, 4.8, 4.8, 4.4, 'fur');
      body.ell(0, 5.2, 1.6, 5.2, 5.2, 4.2, 'spine', (x, y, z) => z >= 1);
      body.paint((x, y, z) => z >= 2 && (x + y + z) % 3 === 0, 'tip');
      for (let y = 3; y <= 9; y += 2) for (let x = -4; x <= 3; x += 2) body.set(x, y, 6, 'spine');
      body.box(-3, 1, -4, 2, 7, -4, 'apron').box(-3, 7, -4, -3, 9, -3, 'strap').box(2, 7, -4, 2, 9, -3, 'strap');
      head.ell(0, 10, -0.6, 4.4, 3.6, 4, 'face').ell(0, 11, 1.4, 4.8, 3.8, 3.6, 'spine', (x, y, z) => z >= 0);
      head.box(-1, 8, -6, 0, 9, -5, 'face').set(-1, 9, -7, 'nose').set(0, 9, -7, 'nose');
      eyes(head, 10, 2);
      earL.ell(-3.5, 13, 0, 1.3, 1.3, 0.8, 'ear'); earR.ell(3.5, 13, 0, 1.3, 1.3, 0.8, 'ear');
      break;
    case 'morrow': // mole miner: velvet charcoal, big pink paws, a little lamp on a band
      colours = { fur: '#3d3b44', dark: '#2e2c33', eye: '#0c0c0e', glint: '#cfd4ff', nose: '#f19ab0', paw: '#f2a7b6', band: '#8a5a2c', lamp: '#ffe27a', foot: '#f2a7b6', ear: '#3d3b44' };
      body.ell(0, 4.6, 0.6, 4.9, 4.8, 4.4, 'fur');
      body.box(-5, 3, -4, -3, 5, -2, 'paw').box(2, 3, -4, 4, 5, -2, 'paw');
      head.ell(0, 10, -0.4, 4.4, 3.6, 4, 'fur').box(-1, 8, -6, 0, 9, -4, 'fur').box(-1, 8, -7, 0, 9, -7, 'nose');
      head.paint((x, y, z) => y === 12 && z >= -4, 'band'); head.box(-1, 12, -5, 0, 13, -5, 'lamp');
      head.front(-3, 10, 'eye'); head.front(2, 10, 'eye');
      break;
    case 'ottoline': // owl librarian: round, a pale face disc, big eyes, wings, little spectacles
      colours = { fur: '#8a6a4e', breast: '#e9d7b8', face: '#f4ead8', eye: '#1a1410', ring: '#f2a23a', glint: '#ffffff', beak: '#e7b43a', wing: '#6d5038', specs: '#c49a3a', foot: '#e7b43a', ear: '#6d5038' };
      body.ell(0, 5, 0.4, 5, 5.4, 4.4, 'fur').paint((x, y, z) => z <= -2 && Math.abs(x + 0.5) <= 3 && y <= 8, 'breast');
      body.paint((x, y, z) => z <= -2 && Math.abs(x + 0.5) <= 3 && y <= 8 && (x + y) % 3 === 0, 'fur');
      body.ell(-5, 5, 0.8, 1.3, 3.5, 3, 'wing').ell(4.5, 5, 0.8, 1.3, 3.5, 3, 'wing');
      head.ell(0, 11, -0.2, 4.8, 3.8, 4, 'fur').ell(0, 11, -2.6, 4.2, 3.2, 2, 'face', (x, y, z) => z <= -3);
      for (const ex of [-3, 1]) { head.front(ex, 11, 'ring'); head.front(ex + 1, 11, 'eye'); head.front(ex, 12, 'eye'); head.front(ex + 1, 12, 'glint'); head.front(ex, 10, 'ring'); head.front(ex + 1, 10, 'ring'); }
      head.box(-1, 9, -5, 0, 10, -5, 'beak');
      head.box(-1, 11, -5, 0, 11, -5, 'specs');
      earL.box(-4, 14, -1, -3, 15, 0, 'ear'); earR.box(2, 14, -1, 3, 15, 0, 'ear');
      break;
    case 'juniper': // rabbit gardener: long ears, a green apron, a white puff tail
      colours = { fur: '#c9a382', light: '#f3e6d6', eye: '#24160f', glint: '#ffffff', nose: '#ef8ea4', ear: '#f2a7b6', rim: '#c9a382', apron: '#6eab4f', pocket: '#4f8a3a', foot: '#f3e6d6', tail: '#ffffff' };
      body.ell(0, 4.6, 0.6, 4.4, 4.8, 4, 'fur').box(-3, 1, -4, 2, 6, -4, 'apron').box(-2, 2, -5, -1, 3, -5, 'pocket');
      head.ell(0, 10, -0.4, 4.4, 3.8, 4, 'fur').paint((x, y, z) => z <= -3 && y <= 9, 'light');
      eyes(head, 10, 2); head.front(0, 9, 'nose'); head.front(-1, 9, 'nose');
      earL.box(-3, 13, 0, -2, 19, 0, 'rim').box(-3, 14, -1, -2, 18, -1, 'ear');
      earR.box(1, 13, 0, 2, 19, 0, 'rim').box(1, 14, -1, 2, 18, -1, 'ear');
      tail.ell(0, 3, 5, 1.8, 1.8, 1.6, 'tail');
      break;
    case 'fennel': // fox musician: orange, white chest and tail tip, dark socks, pointed ears
      colours = { fur: '#e2763a', white: '#fbf3e8', eye: '#1c120c', glint: '#ffffff', nose: '#1c120c', ear: '#2a1a12', inner: '#f6c2a8', foot: '#2a1a12', tail: '#e2763a', tip: '#ffffff', scarf: '#3f7fd0' };
      body.ell(0, 4.6, 0.6, 4.4, 4.8, 4, 'fur').paint((x, y, z) => z <= -2 && Math.abs(x + 0.5) <= 2 && y <= 7, 'white');
      body.paint((x, y) => y === 8, 'scarf');
      head.ell(0, 10.2, -0.4, 4.6, 3.6, 4, 'fur').box(-2, 8, -6, 1, 9, -4, 'white').box(-1, 9, -7, 0, 9, -7, 'nose');
      head.paint((x, y, z) => z <= -3 && y <= 9, 'white');
      eyes(head, 10, 2);
      earL.box(-4, 13, 0, -2, 14, 0, 'ear').box(-4, 15, 0, -3, 16, 0, 'ear').set(-3, 14, -1, 'inner');
      earR.box(1, 13, 0, 3, 14, 0, 'ear').box(2, 15, 0, 3, 16, 0, 'ear').set(2, 14, -1, 'inner');
      tail.ell(0, 3.5, 6, 2.6, 2.6, 3, 'tail').ell(0, 6, 8, 2, 2, 1.6, 'tip');
      break;
    case 'barnaby': // badger smith: grey, a striped face, a leather apron
      colours = { fur: '#8d8f93', dark: '#2a2a2e', white: '#f4f2ee', eye: '#0f0f12', glint: '#ffffff', nose: '#1b1b1e', apron: '#8a5530', strap: '#5e3a20', foot: '#2a2a2e', ear: '#2a2a2e' };
      body.ell(0, 4.6, 0.6, 5.2, 4.9, 4.4, 'fur').box(-3, 1, -5, 2, 7, -4, 'apron').box(-3, 7, -4, -3, 9, -3, 'strap').box(2, 7, -4, 2, 9, -3, 'strap');
      head.ell(0, 10, -0.4, 4.6, 3.7, 4.2, 'white');
      head.paint((x, y, z) => Math.abs(x + 0.5) >= 1.2 && Math.abs(x + 0.5) <= 3 && z <= 1, 'dark');
      head.box(-1, 8, -6, 0, 9, -5, 'white').set(-1, 9, -7, 'nose').set(0, 9, -7, 'nose');
      head.front(-3, 10, 'eye'); head.front(2, 10, 'eye'); head.front(-3, 11, 'glint'); head.front(2, 11, 'glint');
      earL.box(-4, 13, 0, -3, 13, 1, 'ear'); earR.box(2, 13, 0, 3, 13, 1, 'ear');
      break;
  }
  if (!Object.keys(colours).includes('glint')) colours.glint = '#ffffff';
  return {
    name: id, colours, parts: [
      { name: 'body', vox: body, pivot: [0, 0, 0] }, { name: 'head', vox: head, pivot: [0, 7.5, 0] },
      { name: 'earL', vox: earL, pivot: [-3, 12.5, 0] }, { name: 'earR', vox: earR, pivot: [3, 12.5, 0] },
      { name: 'footL', vox: footL, pivot: [-1.5, 1, -1] }, { name: 'footR', vox: footR, pivot: [1.5, 1, -1] },
      { name: 'tail', vox: tail, pivot: [0, 2.5, 4.5] },
    ],
  };
}

// ---------------------------------------------------------------- creatures
/** Dust-bunnies, Grumblefluffs and the night's monsters. Parts: body, plus wings (moth), jaw (gnasher), feet. */
export function critter(kind: CritterKind): Model {
  const body = new Vox(), a = new Vox(), b = new Vox(), c = new Vox();
  let colours: Record<string, string> = {};
  const parts = (pa: [number, number, number], pb: [number, number, number], pc: [number, number, number] = [0, 0, 0]): Part[] => [
    { name: 'body', vox: body, pivot: [0, 0, 0] }, { name: 'a', vox: a, pivot: pa }, { name: 'b', vox: b, pivot: pb }, { name: 'c', vox: c, pivot: pc },
  ];
  switch (kind) {
    case 'bunny': // a round grey fluffball with dot eyes and two little ears
      colours = { fluff: '#c9c3cf', soft: '#ddd8e2', eye: '#1d1a22', glint: '#ffffff', ear: '#e9b4c2' };
      body.ell(0, 3.5, 0, 3.8, 3.5, 3.6, 'fluff').paint((x, y, z) => (x * 7 + y * 3 + z * 5) % 4 === 0, 'soft');
      body.front(-2, 4, 'eye'); body.front(1, 4, 'eye'); body.front(-2, 5, 'glint'); body.front(1, 5, 'glint');
      a.box(-2, 7, 0, -2, 8, 0, 'ear'); b.box(1, 7, 0, 1, 8, 0, 'ear');
      return { name: kind, colours, parts: parts([-2, 7, 0], [1, 7, 0]) };
    case 'grumble': // a grumpy, darker fluffball with heavy brows and a scowl
      colours = { fluff: '#6c6578', soft: '#7d7590', eye: '#ffb23a', brow: '#2c2733', mouth: '#2c2733', ear: '#4e4858', tooth: '#ffffff' };
      body.ell(0, 3.7, 0, 4, 3.7, 3.8, 'fluff').paint((x, y, z) => (x * 5 + y * 7 + z * 3) % 4 === 0, 'soft');
      body.front(-2, 4, 'eye'); body.front(1, 4, 'eye');
      body.front(-3, 6, 'brow'); body.front(-2, 5, 'brow'); body.front(2, 6, 'brow'); body.front(1, 5, 'brow');
      body.front(-1, 2, 'mouth'); body.front(0, 2, 'mouth'); body.front(-1, 1, 'tooth');
      a.box(-3, 7, 0, -2, 8, 0, 'ear'); b.box(1, 7, 0, 2, 8, 0, 'ear');
      return { name: kind, colours, parts: parts([-2, 7, 0], [1, 7, 0]) };
    case 'boar': // a chunky bramble hog: mossy hide, a crest of pink thorns, tusks, a pink snout
      colours = { hide: '#5a4a3a', moss: '#4f6b3a', thorn: '#e58aa6', tusk: '#fbf3e0', snout: '#d98a8f', nostril: '#5a2a2e', eye: '#ffcf4a', foot: '#3a2f26' };
      body.ell(0, 6, 1, 5.4, 5, 7.4, 'hide').paint((x, y, z) => y >= 8, 'moss');
      for (let z = -4; z <= 7; z += 2) { body.set(0, 11, z, 'thorn'); body.set(-1, 12, z + 1, 'thorn'); body.set(-3, 10, z, 'thorn'); body.set(2, 10, z + 1, 'thorn'); }
      body.box(-2, 3, -8, 1, 6, -7, 'snout').set(-1, 4, -9, 'nostril').set(0, 4, -9, 'nostril').box(-2, 3, -9, -2, 5, -9, 'snout').box(1, 3, -9, 1, 5, -9, 'snout');
      body.box(-3, 2, -8, -3, 4, -8, 'tusk').box(2, 2, -8, 2, 4, -8, 'tusk');
      body.front(-3, 8, 'eye'); body.front(2, 8, 'eye');
      a.box(-4, 0, -4, -2, 2, -2, 'foot'); b.box(1, 0, -4, 3, 2, -2, 'foot');
      c.box(-4, 0, 4, -2, 2, 6, 'foot').box(1, 0, 4, 3, 2, 6, 'foot');
      return { name: kind, colours, parts: parts([0, 2, -3], [0, 2, -3], [0, 2, 5]) };
    case 'moth': // a dusky moth: fuzzy body, big soft wings with eye-spots, pale glowing eyes, feathery feelers
      colours = { body: '#4b3d5e', fuzz: '#6a5a80', wing: '#7b6a96', edge: '#3a2f4a', spot: '#d8c8ff', eye: '#e8f6ff', feeler: '#2f2640' };
      body.ell(0, 4, 0, 2, 2.4, 3.4, 'body').paint((x, y, z) => z <= -1, 'fuzz');
      body.front(-1, 5, 'eye'); body.front(0, 5, 'eye');
      body.box(-2, 7, -3, -2, 8, -3, 'feeler').box(1, 7, -3, 1, 8, -3, 'feeler').set(-3, 9, -3, 'feeler').set(2, 9, -3, 'feeler');
      a.ell(-6, 4.5, 0, 4.5, 0.6, 4, 'wing').paint((x, y, z) => Math.abs(z) >= 3 || x <= -9, 'edge').set(-6, 5, -1, 'spot').set(-7, 5, 0, 'spot');
      b.ell(5, 4.5, 0, 4.5, 0.6, 4, 'wing').paint((x, y, z) => Math.abs(z) >= 3 || x >= 8, 'edge').set(5, 5, -1, 'spot').set(6, 5, 0, 'spot');
      return { name: kind, colours, parts: parts([-2, 4.5, 0], [2, 4.5, 0]) };
    case 'gnasher': // a slate-dark cave lump that looks like a rock, until the jaw opens on a row of white teeth
      colours = { rock: '#3e4552', dark: '#2b313b', moss: '#3f5a4a', eye: '#7ff3ff', mouth: '#1a0f14', tooth: '#ffffff', gum: '#b04a6a' };
      body.ell(0, 6.5, 0, 5.5, 4.5, 5, 'rock', (x, y) => y >= 4).paint((x, y, z) => (x * 3 + y * 5 + z * 7) % 5 === 0, 'dark').paint((x, y) => y >= 10, 'moss');
      body.front(-3, 8, 'eye'); body.front(2, 8, 'eye');
      body.box(-4, 4, -5, 3, 4, -5, 'tooth').paint((x, y, z) => y === 4 && z === -5 && x % 2 !== 0, 'gum');
      a.ell(0, 2.5, 0, 5.2, 2.5, 4.8, 'rock', (x, y) => y <= 3).box(-4, 3, -5, 3, 3, -5, 'tooth').paint((x, y, z) => y === 3 && z === -5 && x % 2 === 0, 'mouth');
      return { name: kind, colours, parts: parts([0, 3.5, 3], [0, 0, 0]) };
  }
}

// ---------------------------------------------------------------- props and items
/** Furniture models, in a block's own 16×16×16 space (x, z from 0 to 15, front at z = 0). */
export function prop(key: string): Model | null {
  const v = new Vox();
  let colours: Record<string, string> = {};
  switch (key) {
    case 'lantern': case 'lantern_out': {
      const lit = key === 'lantern';
      colours = { wood: '#5a3a22', metal: '#3a3a40', glass: lit ? '#ffe28a' : '#5b5e66', core: lit ? '#fff6c8' : '#44464e' };
      v.box(5, 0, 5, 10, 0, 10, 'wood').box(6, 1, 6, 9, 6, 9, 'glass').box(7, 2, 7, 8, 4, 8, 'core').box(5, 7, 5, 10, 7, 10, 'wood');
      v.box(6, 1, 6, 6, 6, 6, 'metal').box(9, 1, 9, 9, 6, 9, 'metal').box(6, 1, 9, 6, 6, 9, 'metal').box(9, 1, 6, 9, 6, 6, 'metal');
      v.box(7, 8, 7, 8, 8, 8, 'metal').box(7, 9, 7, 7, 10, 7, 'metal').box(8, 9, 8, 8, 10, 8, 'metal').box(7, 10, 8, 8, 10, 8, 'metal');
      break;
    }
    case 'door':
      colours = { door: '#5f9e6e', dark: '#477d55', frame: '#7a5232', knob: '#f2c24a' };
      for (let y = 0; y <= 15; y++) for (let x = 0; x <= 15; x++) {
        const top = y > 9 ? Math.hypot(x - 7.5, y - 9) <= 7.6 : true;
        if (!top) continue;
        const edge = x === 0 || x === 15 || (y > 9 && Math.hypot(x - 7.5, y - 9) > 6.6);
        v.box(x, y, 7, x, y, 8, edge ? 'frame' : x === 7 || x === 8 ? 'dark' : 'door');
      }
      v.set(11, 7, 6, 'knob');
      break;
    case 'bed':
      colours = { wood: '#8a5a34', quilt: '#e37a8e', check: '#f6c8d0', pillow: '#fbf6ee', sheet: '#fff3e0' };
      v.box(0, 0, 0, 15, 2, 15, 'wood').box(1, 3, 1, 14, 5, 14, 'sheet').box(1, 5, 4, 14, 6, 14, 'quilt').paint((x, y, z) => y === 6 && (x + z) % 4 === 0, 'check');
      v.box(3, 6, 1, 12, 7, 3, 'pillow').box(0, 0, 15, 15, 9, 15, 'wood').box(0, 0, 0, 15, 4, 0, 'wood');
      break;
    case 'workbench':
      colours = { wood: '#b07a46', dark: '#7a5230', thread: '#e3577a', thread2: '#4f8fd6', thread3: '#f2c24a' };
      v.box(0, 10, 0, 15, 12, 15, 'wood').box(1, 0, 1, 2, 9, 2, 'dark').box(13, 0, 1, 14, 9, 2, 'dark').box(1, 0, 13, 2, 9, 14, 'dark').box(13, 0, 13, 14, 9, 14, 'dark');
      v.box(3, 13, 6, 3, 15, 6, 'dark').box(12, 13, 6, 12, 15, 6, 'dark').box(3, 15, 6, 12, 15, 6, 'dark');
      v.box(4, 13, 6, 11, 13, 6, 'thread').box(4, 14, 6, 11, 14, 6, 'thread2').box(5, 13, 9, 9, 13, 11, 'thread3');
      break;
    case 'oven':
      colours = { brick: '#b8573e', mortar: '#d9b49a', mouth: '#2a1510', fire: '#ff9a3a', flame: '#ffd75a' };
      v.ell(7.5, 0, 7.5, 7.6, 14, 7.6, 'brick', (x, y) => y >= 0).paint((x, y, z) => (y % 3 === 0) || ((x + z + (Math.floor(y / 3) % 2) * 2) % 4 === 0 && y % 3 === 1), 'mortar');
      for (let y = 1; y <= 6; y++) for (let x = 5; x <= 10; x++) if (y < 5 || Math.abs(x - 7.5) < 2) { v.del(x, y, 0); v.del(x, y, 1); v.set(x, y, 2, y <= 2 ? 'fire' : 'mouth'); }
      v.set(7, 1, 3, 'flame').set(8, 2, 3, 'flame');
      break;
    case 'cart':
      colours = { wood: '#9a6a3c', band: '#4a4a52', wheel: '#33333a', ore: '#c48a5a', crystal: '#7ff3ff' };
      v.box(2, 3, 1, 13, 9, 14, 'wood').box(3, 5, 2, 12, 9, 13, 'ore').paint((x, y, z) => y === 9 && (x + z) % 3 === 0, 'crystal');
      v.box(2, 6, 1, 13, 6, 1, 'band').box(2, 6, 14, 13, 6, 14, 'band');
      v.box(1, 0, 2, 1, 3, 5, 'wheel').box(14, 0, 2, 14, 3, 5, 'wheel').box(1, 0, 10, 1, 3, 13, 'wheel').box(14, 0, 10, 14, 3, 13, 'wheel');
      break;
    case 'drum':
      colours = { side: '#d24a4a', band: '#f2c24a', skin: '#f6ecd8', rope: '#fff6e0' };
      v.ell(7.5, 0, 7.5, 5.6, 11, 5.6, 'side', (x, y) => y >= 0 && y <= 10);
      v.paint((x, y) => y === 0 || y === 10, 'band').paint((x, y, z) => (y === 3 || y === 7) && (x + z) % 2 === 0, 'rope').paint((x, y) => y === 10, 'skin');
      v.ell(7.5, 11, 7.5, 5.2, 0.6, 5.2, 'skin');
      break;
    case 'anvil':
      colours = { iron: '#4a4f5a', shine: '#8a93a3', stump: '#7a5232', ring: '#a87a4a' };
      v.box(3, 0, 3, 12, 5, 12, 'stump').paint((x, y) => y === 5, 'ring');
      v.box(5, 6, 6, 10, 7, 9, 'iron').box(6, 8, 7, 9, 8, 8, 'iron').box(2, 9, 5, 13, 11, 10, 'iron').box(0, 10, 6, 1, 11, 9, 'iron').paint((x, y) => y === 11, 'shine');
      break;
    case 'pot':
      colours = { pot: '#c8643c', rim: '#e08458', soil: '#5a3a22', stem: '#4f8a3a', petal: '#ffffff', heart: '#f2c24a' };
      v.box(5, 0, 5, 10, 5, 10, 'pot').box(4, 5, 4, 11, 6, 11, 'rim').box(6, 6, 6, 9, 6, 9, 'soil');
      v.box(7, 7, 7, 8, 11, 8, 'stem').box(5, 12, 7, 10, 12, 8, 'petal').box(7, 12, 5, 8, 12, 10, 'petal').box(7, 12, 7, 8, 13, 8, 'heart').set(9, 9, 7, 'stem').set(10, 10, 7, 'stem');
      break;
    case 'fence':
      colours = { wood: '#8a5a34', bark: '#6a4428' };
      v.box(6, 0, 6, 9, 15, 9, 'bark').box(0, 5, 7, 15, 6, 8, 'wood').box(0, 11, 7, 15, 12, 8, 'wood').box(7, 0, 0, 8, 6, 15, 'wood').paint((x, y, z) => y === 5 && z !== 7 && z !== 8 && x !== 7 && x !== 8, 'wood');
      v.paint((x, y, z) => (x < 6 || x > 9) && (y < 5), 'wood');
      for (const [k] of [...v.cells]) { const [x, y, z] = UK(k); if (y <= 6 && (z < 6 || z > 9) && x >= 7 && x <= 8 && y < 5) v.cells.delete(k); }
      break;
    case 'ladder':
      colours = { rail: '#8a5a34', rung: '#c99a5a', rope: '#efe2c4' };
      v.box(2, 0, 14, 3, 15, 15, 'rail').box(12, 0, 14, 13, 15, 15, 'rail');
      for (let y = 1; y <= 15; y += 3) v.box(4, y, 14, 11, y, 14, 'rung').set(3, y, 13, 'rope').set(12, y, 13, 'rope');
      break;
    case 'bench':
      colours = { wood: '#b07a46', dark: '#7a5230' };
      v.box(0, 5, 2, 15, 6, 11, 'wood').box(0, 7, 11, 15, 13, 12, 'wood').paint((x, y, z) => y === 10 && z === 11, 'dark');
      v.box(1, 0, 3, 2, 4, 4, 'dark').box(13, 0, 3, 14, 4, 4, 'dark').box(1, 0, 9, 2, 4, 10, 'dark').box(13, 0, 9, 14, 4, 10, 'dark');
      break;
    case 'bunting':
      colours = { string: '#efe2c4', a: '#e3577a', b: '#f2c24a', c: '#4f8fd6', d: '#6eab4f', post: '#8a5a34' };
      v.box(0, 14, 7, 15, 14, 7, 'string').box(7, 0, 7, 8, 13, 8, 'post');
      ['a', 'b', 'c', 'd'].forEach((col, i) => { const x0 = i * 4; for (let y = 0; y < 4; y++) for (let x = x0 + y / 2; x <= x0 + 3 - y / 2; x++) v.set(Math.floor(x), 13 - y, 7, col); });
      break;
    case 'lamp':
      colours = { metal: '#4a4f5a', crystal: '#9ff8ff', core: '#ffffff', base: '#7a5232' };
      v.box(4, 0, 4, 11, 1, 11, 'base').box(6, 2, 6, 9, 3, 9, 'metal').box(6, 4, 6, 9, 9, 9, 'crystal').box(7, 5, 7, 8, 8, 8, 'core').box(7, 10, 7, 8, 10, 8, 'crystal');
      break;
    case 'chime':
      colours = { wood: '#8a5a34', tube: '#c8d2de', shine: '#ffffff', string: '#efe2c4' };
      v.box(7, 0, 7, 8, 14, 8, 'wood').box(2, 14, 7, 13, 15, 8, 'wood');
      for (const [x, h] of [[3, 7], [6, 9], [10, 8], [12, 6]]) { v.set(x, 13, 7, 'string'); v.box(x, 13 - h, 7, x, 12, 7, 'tube'); v.set(x, 12, 7, 'shine'); }
      break;
    case 'crystal':
      colours = { a: '#7ff3ff', b: '#b38cff', c: '#e8ffff', rock: '#4a4f5a' };
      v.box(3, 0, 3, 12, 1, 12, 'rock').box(6, 2, 6, 8, 11, 8, 'a').box(7, 12, 7, 7, 13, 7, 'c').box(3, 2, 8, 4, 7, 9, 'b').box(10, 2, 4, 11, 8, 5, 'a').box(10, 9, 4, 10, 9, 4, 'c').box(4, 2, 4, 5, 5, 5, 'b');
      break;
    case 'stump':
      colours = { bark: '#6a4428', ring: '#c99a5a', inner: '#e0b880', paper: '#fbf6ee', pin: '#e3577a', ink: '#8a7a6a' };
      v.ell(7.5, 0, 7.5, 6.8, 11, 6.8, 'bark', (x, y) => y >= 0 && y <= 9).ell(7.5, 10, 7.5, 6, 0.6, 6, 'ring').ell(7.5, 10, 7.5, 3.5, 0.6, 3.5, 'inner');
      v.box(4, 3, 0, 11, 8, 0, 'paper').set(7, 8, -1, 'pin').box(5, 6, -1, 10, 6, -1, 'ink').box(5, 4, -1, 9, 4, -1, 'ink');
      break;
    case 'cushion':
      colours = { cloth: '#7f6fd0', light: '#a99cf0', button: '#f2c24a' };
      v.box(2, 0, 2, 13, 3, 13, 'cloth').paint((x, y, z) => y === 3 && (x + z) % 4 < 2, 'light').set(7, 4, 7, 'button');
      break;
    default: return null;
  }
  return { name: key, colours, parts: [{ name: 'body', vox: v, pivot: [0, 0, 0] }] };
}

/** Small models for the items that aren't blocks (and the recipe leaf and a dropped bundle). */
export function item(key: string): Model | null {
  const v = new Vox();
  let colours: Record<string, string> = {};
  switch (key) {
    case 'twig': colours = { a: '#8a5a34', b: '#6eab4f' }; v.box(3, 3, 7, 12, 4, 8, 'a').box(8, 5, 7, 10, 6, 8, 'a').box(10, 7, 7, 11, 7, 8, 'b').box(4, 5, 7, 4, 6, 8, 'b'); break;
    case 'iron': colours = { a: '#7a808c', b: '#b9c2cf', c: '#4a4f5a' }; v.ell(7.5, 6, 7.5, 4, 3.5, 4, 'a').set(6, 8, 6, 'b').set(9, 7, 5, 'b').paint((x, y) => y <= 3, 'c'); break;
    case 'berries': colours = { a: '#d0283c', b: '#ff6a7a', s: '#4f8a3a' }; v.ell(5, 4, 7, 2.6, 2.6, 2.6, 'a').ell(10, 4, 7, 2.6, 2.6, 2.6, 'a').ell(7.5, 8, 7, 2.6, 2.6, 2.6, 'a').set(4, 5, 5, 'b').set(9, 5, 5, 'b').set(7, 9, 5, 'b').box(7, 11, 7, 8, 13, 7, 's'); break;
    case 'fluff': colours = { a: '#efeaf3', b: '#d9d2e2' }; v.ell(7.5, 6, 7.5, 5, 4, 5, 'a').ell(5, 9, 7, 2.5, 2, 2.5, 'a').paint((x, y, z) => (x + y + z) % 3 === 0, 'b'); break;
    case 'cloth': colours = { a: '#7fb0e0', b: '#fbf6ee' }; v.box(2, 3, 2, 13, 5, 13, 'a').paint((x, y, z) => (x + z) % 4 === 0, 'b').box(2, 6, 2, 13, 6, 6, 'a'); break;
    case 'paper': colours = { a: '#fbf6ee', b: '#c9b8a0' }; v.box(3, 3, 2, 12, 3, 13, 'a').box(4, 4, 4, 11, 4, 4, 'b').box(4, 4, 7, 10, 4, 7, 'b').box(4, 4, 10, 9, 4, 10, 'b'); break;
    case 'book': colours = { a: '#4f8fd6', b: '#fbf6ee', c: '#f2c24a' }; v.box(3, 2, 2, 12, 6, 13, 'a').box(4, 3, 3, 12, 5, 12, 'b').box(5, 6, 6, 10, 6, 9, 'c'); break;
    case 'tart': colours = { a: '#e2a75a', b: '#d0283c', c: '#fff3e0' }; v.ell(7.5, 2, 7.5, 6.5, 2.5, 6.5, 'a', (x, y) => y >= 0).box(3, 4, 3, 12, 4, 12, 'b').paint((x, y, z) => y === 4 && (x + z) % 5 === 0, 'c'); break;
    case 'hay': colours = { a: '#e8c75a', b: '#c9a23a' }; for (let i = 0; i < 6; i++) v.box(4 + i, 1, 7, 4 + i, 10 - (i % 3), 8, i % 2 ? 'a' : 'b'); v.box(3, 5, 6, 10, 5, 9, 'b'); break;
    case 'thorns': colours = { a: '#4f6b3a', b: '#e58aa6' }; v.box(2, 6, 7, 13, 7, 8, 'a').set(4, 8, 7, 'b').set(7, 5, 7, 'b').set(10, 8, 8, 'b').set(12, 5, 7, 'b').set(5, 4, 8, 'b'); break;
    case 'shimmer': colours = { a: '#d8c8ff', b: '#ffffff', c: '#9f8ad8' }; v.ell(7.5, 7, 7.5, 3, 3, 3, 'c').set(7, 11, 7, 'b').set(3, 7, 7, 'b').set(12, 6, 8, 'b').set(8, 2, 7, 'a').set(5, 9, 6, 'a'); break;
    case 'pearl': colours = { a: '#3a3550', b: '#8a7ad8', c: '#ffffff' }; v.ell(7.5, 7, 7.5, 4.2, 4.2, 4.2, 'a').paint((x, y) => y >= 8, 'b').set(6, 10, 5, 'c'); break;
    case 'trowel': colours = { a: '#b9c2cf', b: '#7a808c', h: '#8a5a34' }; v.box(6, 0, 7, 9, 5, 8, 'h').box(7, 6, 7, 8, 7, 8, 'b').box(5, 8, 7, 10, 13, 8, 'a').box(6, 14, 7, 9, 14, 8, 'a').box(7, 15, 7, 8, 15, 8, 'a'); break;
    case 'bonk': colours = { a: '#b07a46', b: '#f2c24a', c: '#e3577a' }; v.box(7, 0, 7, 8, 9, 8, 'a').ell(7.5, 12.5, 7.5, 3.4, 3.4, 3.4, 'b').paint((x, y) => y === 12, 'c'); break;
    case 'slingshot': colours = { a: '#8a5a34', b: '#e3577a', c: '#efe2c4' }; v.box(7, 0, 7, 8, 6, 8, 'a').box(4, 7, 7, 5, 13, 8, 'a').box(10, 7, 7, 11, 13, 8, 'a').box(6, 7, 7, 9, 7, 8, 'a').box(5, 12, 7, 10, 12, 7, 'c').box(7, 11, 6, 8, 12, 6, 'b'); break;
    case 'leaf': colours = { a: '#f6c23a', b: '#ffe58a', c: '#c98a1a' }; v.ell(7.5, 8, 7.5, 5, 6.5, 0.8, 'a').box(7, 1, 7, 8, 8, 8, 'c').paint((x, y) => y > 9 && y < 13 && x > 4 && x < 9, 'b'); break;
    case 'bundle': colours = { a: '#c99a5a', b: '#8a5a34', c: '#e3577a' }; v.ell(7.5, 5, 7.5, 5, 5, 5, 'a', (x, y) => y >= 0).box(6, 9, 6, 9, 11, 9, 'b').box(5, 9, 5, 10, 9, 10, 'c'); break;
    default: return null;
  }
  return { name: key, colours, parts: [{ name: 'body', vox: v, pivot: [0, 0, 0] }] };
}
export const PROP_KEYS = ['lantern', 'lantern_out', 'door', 'bed', 'workbench', 'oven', 'cart', 'drum', 'anvil', 'pot', 'fence', 'ladder', 'bench', 'bunting', 'lamp', 'chime', 'crystal', 'stump', 'cushion'];
export const ITEM_MODELS = ['twig', 'iron', 'berries', 'fluff', 'cloth', 'paper', 'book', 'tart', 'hay', 'thorns', 'shimmer', 'pearl', 'trowel', 'bonk', 'slingshot', 'leaf', 'bundle'];
