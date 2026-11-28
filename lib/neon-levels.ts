// Neon Lane: the six signboards. Each night is a hand-drawn maze of glass tubes on a 29 x 15 grid, written as its left
// half (15 columns, the 15th being the centre) and mirrored. Tubes sit on a lattice: tube cells are never at an odd
// column AND an odd row, so corridors are always one tube wide. The tubes are split into circuits here, in code: a
// circuit is a chain of junction-to-junction runs, mirrored on the two halves of the sign, so you can follow one
// circuit end to end and watch it go dark behind you. No DOM.

export const W = 29, H = 15, N = W * H;
/** cell kinds */
export const WALL = 0, TUBE = 1, FUSE = 2, DEN = 3, MOTIF = 4;
export const DX = [0, 0, 1, 0, -1], DY = [0, -1, 0, 1, 0];

export type NightId = 'kopi' | 'frog' | 'turtle' | 'satay' | 'durian' | 'crab';
export interface Night { id: NightId; name: string; place: string; blurb: string; wall: string; motif: NightId; left: string[] }

// legend: '#' tube, 'F' fuse, 'O' the cicaks' drainpipe, 'S' Dora's start (Enzo's is its mirror), 'm' the picture, '.' wall
export const NIGHTS: Night[] = [
  { id: 'kopi', name: 'Corner kopitiam', place: 'Geylang Road', wall: 'wall1', motif: 'kopi',
    blurb: 'The kopi cup sign over a corner coffee shop at the city end of Geylang Road. Four cicaks live in the drainpipe behind it. Long straight tubes, a gentle start.',
    left: [
      '###############',
      '#.....#.......#',
      '#####.#########',
      '#...#.#...#mmmm',
      '#...###...#mmmm',
      '#.....#...#mmmm',
      'F######...#mmmm',
      '#...#.....#mmmm',
      '#...###########',
      '#.....#...#...O',
      '#######...###..',
      '#.....#.....#..',
      'F.#########S###',
      '#.#.......#...#',
      '###############',
    ] },
  { id: 'frog', name: 'Geylang Lor 9 Fresh Frog Porridge', place: '235 Geylang Road, Lorong 9', wall: 'wall2', motif: 'frog',
    blurb: 'Claypot frog porridge till four in the morning. The frog sits low on this sign, so the cicaks come out of the drainpipe above it, right in the middle of the board.',
    left: [
      '###############',
      '#...#.....#...#',
      '###.#######.###',
      '#.#...#...#.#..',
      '#.###########..',
      '#.....#.....#.O',
      '###############',
      '#...#...#.#mmmm',
      'F####...###mmmm',
      '#...#...#.#mmmm',
      '#.#######.#mmmm',
      '#.#...#...#mmmm',
      'F##...#########',
      '#.#...#.....#.#',
      '###...#####S###',
    ] },
  { id: 'turtle', name: 'Tan Ser Seng Herbs Restaurant', place: '29 Lorong Bachok, off Lorong 21', wall: 'wall4', motif: 'turtle',
    blurb: 'The old herbal soup house, famous for its turtle soup since the 1970s. A wide turtle along the bottom of the sign and a maze of short runs above it.',
    left: [
      '###############',
      '#.....#.....#..',
      '#####.#.#######',
      '#...#.#.#...#..',
      'F####.#######..',
      '#...#.#.....#.O',
      '#####.#########',
      '#.....#.#mmmmmm',
      '#.#####.#mmmmmm',
      '#.#...#.#mmmmmm',
      'F##...###mmmmmm',
      '#.....#.#mmmmmm',
      '#####S#########',
      '#...#.....#...#',
      '###############',
    ] },
  { id: 'satay', name: 'Kwong Satay', place: 'Lorong 27A', wall: 'wall3', motif: 'satay',
    blurb: 'Charcoal smoke and pork satay in a little open-air food court off Lorong 27A. Long side corridors, and a fan of skewers right across the top.',
    left: [
      '###############',
      '#...#...#.....#',
      '#####.#########',
      '#...#.#.#mmmmmm',
      '#.###.#.#mmmmmm',
      '#.#...#.#mmmmmm',
      'F##.###.#mmmmmm',
      '#...#...#mmmmmm',
      '#.#############',
      '#.#...#.....#.O',
      '#.#####.#####..',
      '#.#...#.#...#..',
      'F####.###...###',
      '#...#.......#.#',
      '#####S#########',
    ] },
  { id: 'durian', name: 'Durian 36', place: '608 Geylang Road, Lorong 36', wall: 'wall5', motif: 'durian',
    blurb: 'The durian stall that never shuts, with crates stacked under a zinc roof. Twisting runs and lots of junctions: good for shaking a cicak off.',
    left: [
      '###############',
      '#.....#...#...#',
      '#.#####.#######',
      '#.#...#.#.#mmmm',
      '#.#####.###mmmm',
      '#.....#...#mmmm',
      'F######...#mmmm',
      '#.....#...#mmmm',
      '###.###########',
      '#.#.#...#.#...O',
      '#.#.#####.###..',
      '#.#.....#...#..',
      'F##.#########..',
      '#...#.......#..',
      '#####S#########',
    ] },
  { id: 'crab', name: 'Sin Huat Eating House', place: 'Lorong 35', wall: 'wall6', motif: 'crab',
    blurb: 'Crab bee hoon at a corner coffee shop, the last stop up Geylang Road. The big crab sits in the middle and all four cicaks are at their quickest.',
    left: [
      '###############',
      '#...#.....#...#',
      '#.###########.#',
      '#.#...#...#.#.#',
      '###...#########',
      '#.....#.#mmmmmm',
      'F####.#.#mmmmmm',
      '#...#.#.#mmmmmm',
      '#####.#.#mmmmmm',
      '#.....#.#mmmmmm',
      '#.#############',
      '#.#...#...#...O',
      'F##.###.#####..',
      '#...#...#...#..',
      '#####S#########',
    ] },
];

/** neon colours for the circuits, picked so neighbours never match */
export const CIRCUIT_COLOURS = ['#ff5a24', '#ff3d7f', '#2ee6ff', '#ffd23a', '#b46bff', '#fff1d6', '#9dff3a', '#5a8cff'];
/** colours that read alike at a glance (orange and yellow, pink and violet, cyan and blue) are kept apart too */
const HUE = [0, 1, 2, 0, 1, 3, 4, 2];

export interface Circuit { id: number; cells: number[]; colour: number; mirror: number }
export interface Board {
  night: Night;
  kind: Uint8Array;
  /** circuit of each tube cell, -1 elsewhere */
  circuit: Int16Array;
  circuits: Circuit[];
  /** the cicaks' drainpipe and the tube cell in front of it */
  den: number; door: number;
  /** Dora's start, Enzo's start */
  starts: [number, number];
  fuses: number[];
  motif: { x: number; y: number; w: number; h: number };
  /** tube cells in index order */
  tubes: number[];
  /** shortest tube distance between any two cells (N x N, -1 where unreachable or not tube) */
  dist: Int16Array;
}

export const cx = (c: number) => c % W, cy = (c: number) => Math.floor(c / W);
export const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x);
export const step = (c: number, d: number) => (d ? at(cx(c) + DX[d], cy(c) + DY[d]) : c);
export const mirrorCell = (c: number) => cy(c) * W + (W - 1 - cx(c));
const walkable = (k: number) => k === TUBE || k === FUSE;

/** the full 29-column rows of a night: the left half, then its mirror (the right-hand start is Enzo's, written T) */
export function fullRows(left: string[]): string[] {
  return left.map((r) => r + r.slice(0, W >> 1).split('').reverse().join('').replace('S', 'T'));
}

export function buildBoard(night: Night): Board {
  const rows = fullRows(night.left);
  const kind = new Uint8Array(N);
  let den = -1; const starts: [number, number] = [-1, -1]; const fuses: number[] = [];
  let mx0 = W, my0 = H, mx1 = -1, my1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = rows[y][x], c = y * W + x;
    if (ch === '#' || ch === 'S' || ch === 'T') kind[c] = TUBE;
    else if (ch === 'F') { kind[c] = FUSE; fuses.push(c); }
    else if (ch === 'O') { kind[c] = DEN; den = c; }
    else if (ch === 'm') { kind[c] = MOTIF; mx0 = Math.min(mx0, x); my0 = Math.min(my0, y); mx1 = Math.max(mx1, x); my1 = Math.max(my1, y); }
    if (ch === 'S') starts[0] = c;
    if (ch === 'T') starts[1] = c;
  }
  let door = -1;
  for (let d = 1; d <= 4; d++) { const n = step(den, d); if (n >= 0 && walkable(kind[n])) door = n; }
  const tubes: number[] = [];
  for (let c = 0; c < N; c++) if (walkable(kind[c])) tubes.push(c);
  const nbrs = (c: number) => { const o: number[] = []; for (let d = 1; d <= 4; d++) { const n = step(c, d); if (n >= 0 && walkable(kind[n])) o.push(n); } return o; };

  // ── runs: maximal chains of degree-2 tube between junctions (degree 3 or 4)
  const junction = (c: number) => nbrs(c).length >= 3;
  const runOf = new Int16Array(N).fill(-1);
  const runs: { cells: number[]; ends: number[] }[] = [];
  for (const c of tubes) {
    if (junction(c) || runOf[c] >= 0) continue;
    // walk both ways from c to the junctions at each end
    const id = runs.length, ends: number[] = []; runOf[c] = id;
    const parts = nbrs(c).map((first) => {
      let prev = c, cur = first; const part: number[] = [];
      while (!junction(cur) && runOf[cur] < 0) { part.push(cur); runOf[cur] = id; const nx = nbrs(cur).find((n) => n !== prev); if (nx === undefined) break; prev = cur; cur = nx; }
      if (junction(cur)) ends.push(cur);
      return part;
    });
    // in order along the tube: one end, c, the other end
    runs.push({ cells: [...(parts[0] ?? []).reverse(), c, ...(parts[1] ?? [])], ends });
  }
  // a junction next to another junction makes a run of no cells; those links stay with the junctions

  // ── mirror classes: left runs, centre runs (their own mirror), right runs (mirrors of left ones)
  const meanX = (cells: number[]) => cells.reduce((s, c) => s + cx(c), 0) / cells.length;
  const mirrorRun = runs.map((r) => runOf[mirrorCell(r.cells[0])]);
  const runCircuit = new Int16Array(runs.length).fill(-1);
  const circuits: Circuit[] = [];
  const TARGET = 22;
  const side = (i: number) => (mirrorRun[i] === i ? 0 : meanX(runs[i].cells) < (W - 1) / 2 ? -1 : 1);
  const order = runs.map((_, i) => i).filter((i) => side(i) <= 0)
    .sort((a, b) => Math.min(...runs[a].cells.map(cy)) - Math.min(...runs[b].cells.map(cy)) || Math.min(...runs[a].cells.map(cx)) - Math.min(...runs[b].cells.map(cx)));
  for (const start of order) {
    if (runCircuit[start] >= 0) continue;
    const s = side(start);
    const id = circuits.length;
    const cells: number[] = [];
    let cur = start, size = 0;
    const used = new Set<number>();
    // follow the chain: from the last run's far junction, carry on into an unassigned run on the same side
    while (cur >= 0) {
      runCircuit[cur] = id; used.add(cur); cells.push(...runs[cur].cells); size += runs[cur].cells.length;
      if (size >= TARGET) break;
      let next = -1;
      for (const j of runs[cur].ends) {
        for (const n of nbrs(j)) { const r = runOf[n]; if (r >= 0 && runCircuit[r] < 0 && side(r) === s && !used.has(r)) { next = r; break; } }
        if (next >= 0) break;
      }
      cur = next;
    }
    circuits.push({ id, cells, colour: 0, mirror: id });
    if (s < 0) {
      const mid = circuits.length;
      const mcells: number[] = [];
      for (let r = 0; r < runs.length; r++) if (runCircuit[r] === id) { const m = mirrorRun[r]; runCircuit[m] = mid; mcells.push(...runs[m].cells); }
      circuits[id].mirror = mid;
      circuits.push({ id: mid, cells: mcells, colour: 0, mirror: id });
    }
  }
  const circuit = new Int16Array(N).fill(-1);
  for (let r = 0; r < runs.length; r++) for (const c of runs[r].cells) circuit[c] = runCircuit[r];
  // junctions join the smallest neighbouring circuit; a right-hand junction copies its mirror so the sign stays symmetric
  const js = tubes.filter(junction).sort((a, b) => cx(a) - cx(b));
  for (const j of js) {
    if (cx(j) > (W - 1) / 2) { const m = circuit[mirrorCell(j)]; circuit[j] = m >= 0 ? circuits[m].mirror : -1; }
    if (circuit[j] < 0) {
      let best = -1;
      for (const n of nbrs(j)) { const k = circuit[n]; if (k >= 0 && (best < 0 || circuits[k].cells.length < circuits[best].cells.length)) best = k; }
      if (best < 0) best = 0;
      circuit[j] = best;
    }
    circuits[circuit[j]].cells.push(j);
  }
  // colour: neighbouring circuits differ, mirror pairs share a colour
  const touch = circuits.map(() => new Set<number>());
  for (const c of tubes) for (const n of nbrs(c)) if (circuit[c] !== circuit[n]) { touch[circuit[c]].add(circuit[n]); touch[circuit[n]].add(circuit[c]); }
  for (const k of circuits) {
    if (k.mirror < k.id) { k.colour = circuits[k.mirror].colour; continue; }
    const banned = new Set<number>();
    for (const t of [...touch[k.id], ...touch[k.mirror]]) if (t < k.id || circuits[t].mirror < k.id) banned.add(circuits[t].colour);
    const hues = new Set([...banned].map((c) => HUE[c]));
    const start = k.id % CIRCUIT_COLOURS.length, order = CIRCUIT_COLOURS.map((_, i) => (start + i) % CIRCUIT_COLOURS.length);
    k.colour = order.find((c) => !hues.has(HUE[c])) ?? order.find((c) => !banned.has(c)) ?? start;
  }
  for (const k of circuits) k.cells.sort((a, b) => a - b);

  // all-pairs tube distance, by a breadth-first search from every tube cell
  const dist = new Int16Array(N * N).fill(-1);
  const q = new Int32Array(N);
  for (const s of tubes) {
    const base = s * N; let h = 0, t = 0; q[t++] = s; dist[base + s] = 0;
    while (h < t) { const c = q[h++]; const dc = dist[base + c]; for (const n of nbrs(c)) if (dist[base + n] < 0) { dist[base + n] = dc + 1; q[t++] = n; } }
  }
  return { night, kind, circuit, circuits, den, door, starts, fuses, motif: { x: mx0, y: my0, w: mx1 - mx0 + 1, h: my1 - my0 + 1 }, tubes, dist };
}
