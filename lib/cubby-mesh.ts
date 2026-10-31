// Cubby Valley's chunk mesher: turns one 16×16×16 chunk of the world into three lists of quads — solid cubes (greedily
// merged where neighbouring faces share a tile, corner shading and light), see-through cut-outs (glass, berry bushes,
// crossed plants) and water — plus the furniture, meshed from its voxel models. Each vertex carries its position, its
// tile and a position on the tile in block units (so a merged quad repeats its tile), a colour (shade × corner
// shading, or the model's colour), and its sky light and lantern light (0–1). DOM-free, so the tests can check it.
import { World, BLOCKS, TILE_INDEX, CROSS_TILE, CH, W, D, H, WATER, inside } from './cubby-world.js';
import { prop, meshModel, type MeshData } from './cubby-models.js';

export interface Quads { pos: number[]; uv: number[]; tile: number[]; col: number[]; light: number[]; index: number[] }
export interface ChunkMesh { solid: Quads; cutout: Quads; water: Quads; faces: number; quads: number }
const quads = (): Quads => ({ pos: [], uv: [], tile: [], col: [], light: [], index: [] });
const AO = [0.5, 0.68, 0.84, 1];
/** Face shade by direction: +x, -x, +y, -y, +z, -z. */
export const FACE_SHADE = [0.8, 0.8, 1, 0.58, 0.9, 0.9];

const propMeshes = new Map<number, MeshData | null>();
function propMesh(b: number) {
  if (!propMeshes.has(b)) { const m = prop(BLOCKS[b].key); propMeshes.set(b, m ? meshModel(m, 1 / 16) : null); }
  return propMeshes.get(b)!;
}

function push(q: Quads, p: number[][], uv: number[][], tile: number, col: number[][], light: number[][], flip: boolean) {
  const s = q.pos.length / 3;
  for (let i = 0; i < 4; i++) { q.pos.push(...p[i]); q.uv.push(...uv[i]); q.tile.push(tile); q.col.push(...col[i]); q.light.push(...light[i]); }
  if (flip) q.index.push(s + 1, s + 2, s + 3, s + 1, s + 3, s);
  else q.index.push(s, s + 1, s + 2, s, s + 2, s + 3);
}

/** Meshes chunk (cx, cy, cz). */
export function meshChunk(w: World, cx: number, cy: number, cz: number): ChunkMesh {
  const out: ChunkMesh = { solid: quads(), cutout: quads(), water: quads(), faces: 0, quads: 0 };
  const X0 = cx * CH, Y0 = cy * CH, Z0 = cz * CH;
  const B = w.blocks, L = w.light;
  const id = (x: number, y: number, z: number) => (inside(x, y, z) ? B[(y * D + z) * W + x] & 63 : y < 0 ? 1 : 0);
  const opaqueAt = (x: number, y: number, z: number) => BLOCKS[id(x, y, z)].opaque;
  const lightAt = (x: number, y: number, z: number) => (inside(x, y, z) ? L[(y * D + z) * W + x] : y >= H ? 0xf0 : 0);

  // the six directions: axis d, sign s; u and v are the face's other two axes (v is up on side faces)
  const dirs: { d: number; s: number; u: number; v: number; k: number }[] = [
    { d: 0, s: 1, u: 2, v: 1, k: 0 }, { d: 0, s: -1, u: 2, v: 1, k: 1 }, { d: 1, s: 1, u: 0, v: 2, k: 2 },
    { d: 1, s: -1, u: 0, v: 2, k: 3 }, { d: 2, s: 1, u: 0, v: 1, k: 4 }, { d: 2, s: -1, u: 0, v: 1, k: 5 },
  ];
  const mask = new Float64Array(CH * CH), meta = new Array<number[] | null>(CH * CH);
  const c = [0, 0, 0];
  for (const pass of ['solid', 'cutout', 'water'] as const) {
    const q = out[pass];
    for (const dir of dirs) {
      const { d, s, u, v } = dir;
      for (let slice = 0; slice < CH; slice++) {
        mask.fill(0);
        for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
          c[d] = slice; c[u] = i; c[v] = j;
          const x = X0 + c[0], y = Y0 + c[1], z = Z0 + c[2];
          const b = id(x, y, z), def = BLOCKS[b];
          const n = [x, y, z]; n[d] += s;
          const nb = id(n[0], n[1], n[2]), nd = BLOCKS[nb];
          let want = false;
          if (pass === 'solid') want = def.shape === 'cube' && def.opaque && !nd.opaque;
          else if (pass === 'cutout') want = def.shape === 'cube' && !def.opaque && !nd.opaque && nb !== b;
          else want = b === WATER && nb !== WATER && !nd.opaque;
          if (!want) continue;
          const tiles = def.tiles ?? ['white', 'white', 'white'];
          const tname = pass === 'water' ? 'water' : d === 1 ? (s > 0 ? tiles[0] : tiles[2]) : tiles[1];
          const tile = TILE_INDEX[tname] ?? 0;
          // per corner: ambient occlusion and smoothed light from the four cells round that corner on the open side
          const ao: number[] = [], sky: number[] = [], lamp: number[] = [];
          for (const [a, bb] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
            const du = a ? 1 : -1, dv = bb ? 1 : -1;
            const p1 = [...n]; p1[u] += du;
            const p2 = [...n]; p2[v] += dv;
            const p3 = [...n]; p3[u] += du; p3[v] += dv;
            const o1 = opaqueAt(p1[0], p1[1], p1[2]) ? 1 : 0, o2 = opaqueAt(p2[0], p2[1], p2[2]) ? 1 : 0, o3 = opaqueAt(p3[0], p3[1], p3[2]) ? 1 : 0;
            ao.push(pass === 'water' ? 3 : o1 && o2 ? 0 : 3 - (o1 + o2 + o3));
            let ss = 0, ll = 0, cnt = 0;
            for (const [p, o] of [[n, 0], [p1, o1], [p2, o2], [p3, o1 && o2 ? 1 : o3]] as [number[], number][]) {
              if (o) continue; const lv = lightAt(p[0], p[1], p[2]); ss += lv >> 4; ll += lv & 15; cnt++;
            }
            sky.push(Math.round(ss / cnt)); lamp.push(Math.round(ll / cnt));
          }
          let key = tile + 64 * (ao[0] + 4 * ao[1] + 16 * ao[2] + 64 * ao[3]);
          key += 16384 * (sky[0] + 16 * sky[1] + 256 * sky[2] + 4096 * sky[3]);
          key += 16384 * 65536 * (lamp[0] + 16 * lamp[1] + 256 * lamp[2] + 4096 * lamp[3]);
          mask[j * CH + i] = key + 1;
          meta[j * CH + i] = [tile, ...ao, ...sky, ...lamp];
        }
        // greedy: grow each face along u, then along v, while the key matches
        for (let j = 0; j < CH; j++) for (let i = 0; i < CH; ) {
          const key = mask[j * CH + i];
          if (!key) { i++; continue; }
          let wdt = 1; while (i + wdt < CH && mask[j * CH + i + wdt] === key) wdt++;
          let hgt = 1;
          grow: for (; j + hgt < CH; hgt++) for (let k = 0; k < wdt; k++) if (mask[(j + hgt) * CH + i + k] !== key) break grow;
          for (let jj = 0; jj < hgt; jj++) for (let ii = 0; ii < wdt; ii++) mask[(j + jj) * CH + i + ii] = 0;
          const m = meta[j * CH + i]!, tile = m[0], ao = m.slice(1, 5), sky = m.slice(5, 9), lamp = m.slice(9, 13);
          const pts: number[][] = [], uvs: number[][] = [], cols: number[][] = [], lights: number[][] = [];
          const plane = slice + (s > 0 ? 1 : 0);
          const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
          for (let k = 0; k < 4; k++) {
            const [a, bb] = corners[k];
            const p = [0, 0, 0]; p[d] = plane; p[u] = i + a * wdt; p[v] = j + bb * hgt;
            let py = Y0 + p[1];
            if (pass === 'water' && d !== 1 && bb === 1) py -= 0.12;
            if (pass === 'water' && d === 1 && s > 0) py -= 0.12;
            pts.push([X0 + p[0], py, Z0 + p[2]]);
            const uu = (d === 2 && s < 0) || (d === 0 && s > 0) ? -(i + a * wdt) : i + a * wdt;
            const vv = j + bb * hgt;
            uvs.push([uu, vv]);
            const f = AO[ao[k]] * FACE_SHADE[dir.k];
            cols.push([f, f, f]); lights.push([sky[k] / 15, lamp[k] / 15]);
          }
          // wind every quad counter-clockwise seen from outside
          const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]], e2 = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
          const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          if (cr[d] * s < 0) { pts.reverse(); uvs.reverse(); cols.reverse(); lights.reverse(); ao.reverse(); }
          // split along the brighter diagonal so corner shading doesn't streak
          push(q, pts, uvs, tile, cols, lights, ao[0] + ao[2] < ao[1] + ao[3]);
          out.faces += wdt * hgt; out.quads++;
          i += wdt;
        }
      }
    }
  }
  // crossed plants and furniture
  for (let y = Y0; y < Y0 + CH; y++) for (let z = Z0; z < Z0 + CH; z++) for (let x = X0; x < X0 + CH; x++) {
    const b = id(x, y, z), def = BLOCKS[b];
    if (def.shape !== 'cross' && def.shape !== 'prop') continue;
    const lv = lightAt(x, y, z), lt = [(lv >> 4) / 15, (lv & 15) / 15];
    if (def.shape === 'cross') {
      const tile = TILE_INDEX[CROSS_TILE[b] ?? 'tallgrass'];
      const j = (((x * 73856093) ^ (z * 19349663)) >>> 0) % 100 / 100 * 0.3 - 0.15;
      for (const [ax, az, bx, bz] of [[0.15, 0.15, 0.85, 0.85], [0.15, 0.85, 0.85, 0.15]]) {
        const p = [[x + ax + j, y, z + az], [x + bx + j, y, z + bz], [x + bx + j, y + 0.95, z + bz], [x + ax + j, y + 0.95, z + az]];
        const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
        const col = [[0.82, 0.82, 0.82], [0.82, 0.82, 0.82], [1, 1, 1], [1, 1, 1]];
        push(out.cutout, p, uv, tile, col, [lt, lt, lt, lt], false);
        push(out.cutout, [p[1], p[0], p[3], p[2]], [uv[1], uv[0], uv[3], uv[2]], tile, col, [lt, lt, lt, lt], false);
      }
      continue;
    }
    const m = propMesh(b); if (!m) continue;
    const f = def.facing ? w.facing(x, y, z) : 0, ang = (f * Math.PI) / 2, cs = Math.cos(ang), sn = Math.sin(ang);
    const q = out.solid, start = q.pos.length / 3, glow = def.light ? Math.max(lt[1], 1) : lt[1];
    for (let k = 0; k < m.pos.length; k += 3) {
      const px = m.pos[k] - 0.5, pz = m.pos[k + 2] - 0.5;
      // facing 1 turns the model a quarter to the left, like the yaw of whoever placed it
      q.pos.push(x + 0.5 + px * cs + pz * sn, y + m.pos[k + 1], z + 0.5 - px * sn + pz * cs);
      q.uv.push(0, 0); q.tile.push(-1); q.col.push(m.col[k], m.col[k + 1], m.col[k + 2]); q.light.push(def.light ? 1 : lt[0], glow);
    }
    for (const i of m.index) q.index.push(start + i);
    out.faces += m.index.length / 6;
  }
  return out;
}
