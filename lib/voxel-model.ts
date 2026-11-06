// Voxel models and meshing, shared by the arcade's voxel games, with no DOM and no Three.js so it runs in Node too.
// A model is the JSON written by an art script (scripts/snowball-art.py): its size, a palette, and its surface cubes as
// flat [x, y, z, colour] quads, or [x, y, z, front colour, side colour] with stride 5 (the front face painted from the
// front view, the sides and back from the side view). meshVoxels turns any grid of coloured cubes into plain arrays for a BufferGeometry:
// only faces between a cube and empty space, flat normals, and per-vertex ambient occlusion (each corner darkened by
// the cubes touching it), with the quad split along the brighter diagonal so the shading never creases.

export interface VoxelModelJson { name: string; size: [number, number, number]; palette: string[]; stride?: 4 | 5; cubes: number[] }
/** cells: each cube's front colour index, plus its side colour index × 256 */
export interface VoxelModel { name: string; size: [number, number, number]; colours: [number, number, number][]; cells: Map<number, number> }
/** uvs run 0 to 1 across each cube face, so a material can draw an edge round every cube */
export interface MeshArrays { positions: Float32Array; normals: Float32Array; colors: Float32Array; uvs: Float32Array; indices: Uint32Array }

const hex = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
export const cellKey = (x: number, y: number, z: number) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);

export function parseModel(j: VoxelModelJson): VoxelModel {
  const colours = j.palette.map(hex), cells = new Map<number, number>();
  const k = j.stride ?? 4;
  for (let i = 0; i + k - 1 < j.cubes.length; i += k) cells.set(cellKey(j.cubes[i], j.cubes[i + 1], j.cubes[i + 2]), j.cubes[i + 3] + (k === 5 ? j.cubes[i + 4] : j.cubes[i + 3]) * 256);
  return { name: j.name, size: j.size, colours, cells };
}

/** the six faces (+x, -x, +y, -y, +z, -z): normal, then the four corners (as offsets in the cube) going round the face */
const FACES: { n: [number, number, number]; c: [number, number, number][] }[] = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];
const AO = [0.52, 0.7, 0.86, 1];
const UV = [0, 0, 0, 1, 1, 1, 1, 0];

/**
 * Mesh every cube in [x0, x1) × [y0, y1) × [z0, z1). solid(x, y, z) says whether a cell blocks (used for culling and
 * occlusion, and may look outside the box); colour(x, y, z, face) gives the colour of that face of the cube (face is an
index into the six faces above), or null where there's no cube.
 * scale is the size of one cube, origin is added to every position.
 */
export function meshVoxels(
  box: [number, number, number, number, number, number],
  solid: (x: number, y: number, z: number) => boolean,
  colour: (x: number, y: number, z: number, face: number) => [number, number, number] | null,
  scale = 1, origin: [number, number, number] = [0, 0, 0], ao = true,
): MeshArrays {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [];
  const [x0, x1, y0, y1, z0, z1] = box;
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
    if (!colour(x, y, z, 4)) continue;
    for (let fi = 0; fi < 6; fi++) {
      const f = FACES[fi], [nx, ny, nz] = f.n;
      if (solid(x + nx, y + ny, z + nz)) continue;
      const c = colour(x, y, z, fi)!;
      const base = pos.length / 3, lights: number[] = [];
      for (let k = 0; k < 4; k++) {
        const [cx, cy, cz] = f.c[k];
        uv.push(UV[k * 2], UV[k * 2 + 1]);
        pos.push((x + cx) * scale + origin[0], (y + cy) * scale + origin[1], (z + cz) * scale + origin[2]);
        nor.push(nx, ny, nz);
        let l = 1;
        if (ao) {
          // the two side cubes and the corner cube in front of this corner of the face
          const sx = cx * 2 - 1, sy = cy * 2 - 1, sz = cz * 2 - 1;
          const ax = nx ? 0 : sx, ay = ny ? 0 : sy, az = nz ? 0 : sz;
          let s1: boolean, s2: boolean;
          if (nx) { s1 = solid(x + nx, y + ay, z); s2 = solid(x + nx, y, z + az); }
          else if (ny) { s1 = solid(x + ax, y + ny, z); s2 = solid(x, y + ny, z + az); }
          else { s1 = solid(x + ax, y, z + nz); s2 = solid(x, y + ay, z + nz); }
          const cr = solid(x + nx + ax, y + ny + ay, z + nz + az);
          l = AO[s1 && s2 ? 0 : 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + (cr ? 1 : 0))];
        }
        lights.push(l);
        col.push(c[0] * l, c[1] * l, c[2] * l);
      }
      if (lights[0] + lights[2] >= lights[1] + lights[3]) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    }
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), colors: new Float32Array(col), uvs: new Float32Array(uv), indices: new Uint32Array(idx) };
}

/** mesh a whole model, centred on x and z with its feet at y = 0, at the given cube size */
export function meshModel(m: VoxelModel, scale: number, ao = true): MeshArrays {
  const [w, h, d] = m.size;
  const solid = (x: number, y: number, z: number) => m.cells.has(cellKey(x, y, z)) || (x >= 0 && x < w && y >= 0 && y < h && z >= 0 && z < d && interior(m, x, y, z));
  // the front face, and the top and bottom of a column's front-most cube, take the front colour; the rest the side colour
  const colour = (x: number, y: number, z: number, face: number) => {
    const v = m.cells.get(cellKey(x, y, z)); if (v === undefined) return null;
    const front = face === 4 || ((face === 2 || face === 3) && !m.cells.has(cellKey(x, y, z + 1)));
    return m.colours[front ? v & 255 : v >> 8];
  };
  return meshVoxels([0, w, 0, h, 0, d], solid, colour, scale, [-w * scale / 2, 0, -d * scale / 2], ao);
}

/** the files hold only surface cubes, so a cell boxed in on all six sides by surface cubes counts as solid inside */
function interior(m: VoxelModel, x: number, y: number, z: number) {
  const c = m.cells;
  const ray = (dx: number, dy: number, dz: number) => { for (let k = 1; k < 64; k++) { const a = x + dx * k, b = y + dy * k, e = z + dz * k; if (a < 0 || b < 0 || e < 0 || a >= m.size[0] || b >= m.size[1] || e >= m.size[2]) return false; if (c.has(cellKey(a, b, e))) return true; } return false; };
  return ray(1, 0, 0) && ray(-1, 0, 0) && ray(0, 1, 0) && ray(0, -1, 0) && ray(0, 0, 1) && ray(0, 0, -1);
}
