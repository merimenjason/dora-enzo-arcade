// Dragon Playground: the five races. Each race is a fixed list of hand-placed chunks, built into flat arrays the
// engine reads (ground kinds, gaps, solid tops, walls, grab points, boost pads, toasts, otter drain shortcuts, crow
// zones, checkpoints). A seed only changes the crows and the otters' small choices, never the course. No DOM.

export type Ground = 'path' | 'sand' | 'grass';
export type Power = 'flutter' | 'gulp' | 'seed' | 'twin';
export type Chunk =
  | { k: 'run'; w: number; g?: Ground }
  | { k: 'sand'; w: number }
  | { k: 'gap'; w: number }               // an open longkang: jump it (otters swim it)
  | { k: 'bench'; n?: number }             // void-deck stone benches to hop
  | { k: 'slide' }                         // climb the ladder side, then press Down on the chute for a boost
  | { k: 'seesaw' }                        // land on it from a jump for a tall spring
  | { k: 'swing' }                         // the rider grabs the swing chain: a fling
  | { k: 'bars'; w: number }               // monkey bars over a longkang: the rider grabs and the dragon swings across
  | { k: 'poles'; n: number }              // laundry poles out from a block: each one a grab and fling
  | { k: 'voiddeck'; w: number }           // a low ceiling (no high jumps), pillars to weave
  | { k: 'mgr' }                           // merry-go-round: run across it for a spin boost
  | { k: 'grate'; to: number }             // an otter shortcut: a drain grate here, they pop out `to` px further on
  | { k: 'stall'; n: number }              // pasar malam stalls: low awnings to belly-slide under
  | { k: 'stones'; n: number };            // stepping stones over the river (Bishan Park)

export interface Race {
  id: string; from: string; to: string; name: string; blurb: string; tip: string;
  night: boolean; rain: boolean; power: Power | null; wakes: string;
  otter: number;          // the otters' speed as a share of the dragon's run
  crows: number;          // crows per 1000 px of course, on average
  chunks: Chunk[];
}

const R = (w: number, g: Ground = 'path'): Chunk => ({ k: 'run', w, g });

export const RACES: Race[] = [
  {
    id: 'r1', from: 'Lorong 6 Toa Payoh', to: 'Dakota Crescent', name: 'First Light', night: false, rain: false,
    power: 'flutter', wakes: 'the Dakota Crescent dove', otter: 0.86, crows: 0.25,
    blurb: 'Dusk, and the old dragon in the sandpit stretches, shakes the sand out of its tiles and looks at you. The Bishan otters are already lined up beside it. They say every playground is theirs.',
    tip: 'Hold right to run, K to jump (hold it to go higher). On a slide, press Down for a burst of speed.',
    chunks: [R(500), { k: 'sand', w: 400 }, R(300), { k: 'bench' }, R(400), { k: 'slide' }, R(400), { k: 'gap', w: 160 },
      R(400, 'grass'), { k: 'grate', to: 900 }, R(300, 'grass'), { k: 'seesaw' }, R(400), { k: 'sand', w: 300 }, R(200),
      { k: 'swing' }, R(500), { k: 'bench', n: 2 }, R(400, 'grass'), { k: 'gap', w: 200 }, R(400), { k: 'slide' }, R(300),
      { k: 'mgr' }, R(500), { k: 'bars', w: 360 }, R(500, 'grass'), { k: 'grate', to: 700 }, { k: 'sand', w: 300 }, R(300),
      { k: 'seesaw' }, R(400), { k: 'gap', w: 180 }, R(600)],
  },
  {
    id: 'r2', from: 'Dakota Crescent', to: 'Pipit Road, MacPherson', name: 'Washing Day', night: false, rain: false,
    power: 'gulp', wakes: 'the Pipit Road pelican', otter: 0.9, crows: 0.35,
    blurb: 'The dove is awake and cooing. Through the old low blocks and the void decks to MacPherson, where a pelican with a dragon\'s head has been asleep for years.',
    tip: 'Void decks have low ceilings. Laundry poles: the rider grabs them (L) and the dragon flings forward.',
    chunks: [R(500), { k: 'voiddeck', w: 700 }, R(300), { k: 'poles', n: 3 }, R(400), { k: 'gap', w: 180 }, R(300),
      { k: 'slide' }, R(300), { k: 'grate', to: 800 }, { k: 'voiddeck', w: 600 }, R(400, 'grass'), { k: 'seesaw' }, R(300),
      { k: 'poles', n: 4 }, R(300), { k: 'bench', n: 2 }, R(400), { k: 'bars', w: 380 }, R(400), { k: 'sand', w: 400 },
      R(300), { k: 'swing' }, R(400), { k: 'voiddeck', w: 800 }, R(300), { k: 'mgr' }, R(400), { k: 'grate', to: 900 },
      { k: 'gap', w: 200 }, R(400, 'grass'), { k: 'poles', n: 3 }, R(400), { k: 'slide' }, R(600)],
  },
  {
    id: 'r3', from: 'Pipit Road', to: 'Tampines Avenue 5', name: 'Monsoon Run', night: false, rain: true,
    power: 'seed', wakes: 'the Tampines watermelon', otter: 0.93, crows: 0.2,
    blurb: 'Rain comes down sideways. The drains fill up fast, which suits the otters fine, and every slide is twice as slippery and twice as quick.',
    tip: 'In the rain, slides give a longer burst. Wider longkangs: use the monkey bars.',
    chunks: [R(500), { k: 'slide' }, R(300), { k: 'gap', w: 220 }, R(400, 'grass'), { k: 'grate', to: 1000 }, { k: 'bars', w: 420 },
      R(300), { k: 'sand', w: 300 }, R(300), { k: 'seesaw' }, R(400), { k: 'slide' }, R(300), { k: 'gap', w: 240 }, R(300),
      { k: 'swing' }, R(400), { k: 'voiddeck', w: 600 }, R(300), { k: 'poles', n: 3 }, R(400), { k: 'bars', w: 440 },
      R(300, 'grass'), { k: 'grate', to: 900 }, { k: 'mgr' }, R(400), { k: 'slide' }, R(300), { k: 'gap', w: 220 }, R(400),
      { k: 'bench', n: 3 }, R(400), { k: 'seesaw' }, R(600)],
  },
  {
    id: 'r4', from: 'Tampines', to: 'Ang Mo Kio Avenue 3', name: 'Pasar Malam', night: true, rain: false,
    power: 'twin', wakes: 'the Ang Mo Kio mini dragon', otter: 0.95, crows: 0.3,
    blurb: 'Night market night. Stalls, strings of bulbs, and a crowd that has no idea a dragon is coming through. Somewhere at the end is a little dragon who has been waiting since 1980-something.',
    tip: 'Stall awnings hang low: hold Down to belly-slide under them without losing speed.',
    chunks: [R(500), { k: 'stall', n: 3 }, R(300), { k: 'slide' }, R(300), { k: 'gap', w: 220 }, R(300), { k: 'stall', n: 4 },
      R(300), { k: 'grate', to: 900 }, { k: 'seesaw' }, R(400), { k: 'poles', n: 3 }, R(300), { k: 'bars', w: 420 }, R(400),
      { k: 'stall', n: 3 }, R(300), { k: 'swing' }, R(300), { k: 'voiddeck', w: 600 }, R(300), { k: 'mgr' }, R(400),
      { k: 'grate', to: 1000 }, { k: 'gap', w: 240 }, R(300), { k: 'slide' }, R(300), { k: 'stall', n: 4 }, R(400),
      { k: 'bench', n: 2 }, R(300), { k: 'seesaw' }, R(600)],
  },
  {
    id: 'r5', from: 'Ang Mo Kio', to: 'Lorong 6 Toa Payoh', name: 'Otter River', night: true, rain: false,
    power: null, wakes: 'every playground in the estate', otter: 0.97, crows: 0.3,
    blurb: 'Home through Bishan Park, along the river the otters grew up in. This is their turf, and they know every shortcut. Win this and the whole estate wakes up.',
    tip: 'Stepping stones: jump from stone to stone. The otters will swim it, faster than you think.',
    chunks: [R(500, 'grass'), { k: 'stones', n: 5 }, R(300, 'grass'), { k: 'grate', to: 900 }, { k: 'slide' }, R(300),
      { k: 'bars', w: 440 }, R(300, 'grass'), { k: 'stones', n: 6 }, R(300, 'grass'), { k: 'seesaw' }, R(300), { k: 'swing' },
      R(300), { k: 'gap', w: 240 }, R(300), { k: 'grate', to: 1000 }, { k: 'stall', n: 3 }, R(300), { k: 'poles', n: 3 },
      R(300), { k: 'stones', n: 6 }, R(300, 'grass'), { k: 'mgr' }, R(300), { k: 'slide' }, R(300), { k: 'bars', w: 460 },
      R(300), { k: 'voiddeck', w: 600 }, R(300), { k: 'grate', to: 900 }, { k: 'gap', w: 260 }, R(300), { k: 'seesaw' },
      R(400, 'sand'), R(600)],
  },
];

// ─────────────────────────────────────────────────────────────── the built course
export interface Top { x0: number; x1: number; y0: number; y1: number; kind: 'slide' | 'plank' | 'bench' | 'stone' | 'ladder' }
export interface Wall { x: number; h: number }          // blocks a runner moving right whose feet are below h
export interface Grab { kind: 'swing' | 'pole' | 'bars'; x: number; y: number; x1: number }
export interface Pad { x0: number; x1: number }
export interface Ceil { x0: number; x1: number; y: number; kind: 'voiddeck' | 'stall' }
export interface Course {
  len: number; finish: number;
  ground: { x0: number; x1: number; g: Ground }[];   // solid floor at y = 0 (anything not covered is a gap)
  gaps: { x0: number; x1: number; water: boolean }[];
  tops: Top[]; walls: Wall[]; grabs: Grab[]; pads: Pad[]; ceils: Ceil[];
  seesaws: { x0: number; x1: number }[];
  slides: { x0: number; x1: number; top: number }[];  // the chute runs from (x0, top) down to (x1, 0)
  toasts: { x: number; y: number }[];
  grates: { a: number; b: number }[];
  checkpoints: number[];                               // safe x positions to put a fallen dragon back
  props: { kind: string; x: number; y?: number; w?: number }[];   // drawing hints for the scene
}

// Prop sizes come from the painted art (scripts/dragon-art.py): each prop is drawn to fit its footprint width, so the
// heights below are the art's own proportions at that width.
export const SLIDE_W = 560, SLIDE_TOP = 192, SLIDE_DECK0 = 70, SLIDE_DECK1 = 248, SLIDE_LIP = 545;
export const BENCH_H = 46, BENCH_W = 150;
export const POLE_W = 520, POLE_Y = 170, SWING_W = 300, SWING_Y = 160;
export const BARS_RAIL = 195 / 499;              // the monkey-bar rail's height as a share of the bars' width
export const VOID_CEIL = 250, STALL_CEIL = 120;
export const SEESAW_W = 380, SEESAW_H = 102, MGR_W = 260;
export const STONE_W = 220, STONE_GAP = 140, STONE_H = 18;   // one tap-jump from stone to stone

export function buildCourse(race: Race): Course {
  const c: Course = { len: 0, finish: 0, ground: [], gaps: [], tops: [], walls: [], grabs: [], pads: [], ceils: [], seesaws: [],
    slides: [], toasts: [], grates: [], checkpoints: [0], props: [] };
  let x = 0;
  const floor = (w: number, g: Ground = 'path') => { c.ground.push({ x0: x, x1: x + w, g }); };
  const toastArc = (x0: number, x1: number, y0: number, peak: number, n: number) => {
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); c.toasts.push({ x: x0 + (x1 - x0) * t, y: y0 + peak * 4 * t * (1 - t) }); }
  };
  let pendingGrate: number | null = null;
  for (const ch of race.chunks) {
    switch (ch.k) {
      case 'run': floor(ch.w, ch.g); if (ch.w >= 400) toastArc(x + 120, x + ch.w - 120, 60, 0, 2); x += ch.w; break;
      case 'sand': floor(ch.w, 'sand'); c.props.push({ kind: 'sandpit', x, w: ch.w }); toastArc(x + 60, x + ch.w - 60, 80, 150, 3); x += ch.w; break;
      case 'gap': {
        c.checkpoints.push(x - 140);
        c.gaps.push({ x0: x, x1: x + ch.w, water: true }); c.props.push({ kind: 'longkang', x, w: ch.w });
        toastArc(x - 40, x + ch.w + 40, 90, 170, 3); x += ch.w; c.checkpoints.push(x + 60); break;
      }
      case 'bench': {
        const n = ch.n ?? 1;
        for (let i = 0; i < n; i++) {
          floor(BENCH_W + 260);
          c.tops.push({ x0: x + 130, x1: x + 130 + BENCH_W, y0: BENCH_H, y1: BENCH_H, kind: 'bench' });
          c.walls.push({ x: x + 130, h: BENCH_H }); c.props.push({ kind: 'bench', x: x + 130, w: BENCH_W });
          c.toasts.push({ x: x + 130 + BENCH_W / 2, y: BENCH_H + 150 });
          x += BENCH_W + 260;
        }
        break;
      }
      case 'slide': {
        floor(SLIDE_W + 80);
        const lx = x + 40, px1 = lx + SLIDE_DECK1, cx1 = lx + SLIDE_LIP;
        c.walls.push({ x: lx + SLIDE_DECK0, h: SLIDE_TOP });
        c.tops.push({ x0: lx + SLIDE_DECK0, x1: px1, y0: SLIDE_TOP, y1: SLIDE_TOP, kind: 'ladder' });
        c.tops.push({ x0: px1, x1: cx1, y0: SLIDE_TOP, y1: 0, kind: 'slide' });
        c.slides.push({ x0: px1, x1: cx1, top: SLIDE_TOP });
        c.props.push({ kind: 'slide', x: lx, w: SLIDE_W });
        toastArc(px1 + 40, cx1 - 30, SLIDE_TOP + 40, -SLIDE_TOP / 4, 4);
        x += SLIDE_W + 80; break;
      }
      case 'seesaw': {
        floor(SEESAW_W + 200);
        c.seesaws.push({ x0: x + 100, x1: x + 100 + SEESAW_W }); c.walls.push({ x: x + 100, h: SEESAW_H - 22 }); c.props.push({ kind: 'seesaw', x: x + 100, w: SEESAW_W });
        toastArc(x + 200, x + 700, 300, 260, 4);
        x += SEESAW_W + 200; break;
      }
      case 'swing': {
        floor(420); c.grabs.push({ kind: 'swing', x: x + 210, y: SWING_Y, x1: x + 210 }); c.props.push({ kind: 'swing', x: x + 210 - SWING_W / 2, w: SWING_W });
        c.toasts.push({ x: x + 330, y: SWING_Y + 140 });
        x += 420; break;
      }
      case 'bars': {
        floor(120); x += 120;
        c.checkpoints.push(x - 100);
        c.gaps.push({ x0: x, x1: x + ch.w, water: true }); c.props.push({ kind: 'longkang', x, w: ch.w });
        const rail = Math.round((ch.w + 120) * BARS_RAIL);
        c.grabs.push({ kind: 'bars', x: x - 60, y: rail, x1: x + ch.w + 60 }); c.props.push({ kind: 'bars', x: x - 60, w: ch.w + 120 });
        toastArc(x + 40, x + ch.w - 40, rail - 150, 0, 3);
        x += ch.w; floor(120); x += 120; c.checkpoints.push(x - 40); break;
      }
      case 'poles': {
        for (let i = 0; i < ch.n; i++) {
          floor(POLE_W); c.grabs.push({ kind: 'pole', x: x + 300, y: POLE_Y, x1: x + 300 }); c.props.push({ kind: 'pole', x, w: POLE_W });
          c.toasts.push({ x: x + 440, y: POLE_Y + 110 }); x += POLE_W;
        }
        break;
      }
      case 'voiddeck': {
        floor(ch.w); c.ceils.push({ x0: x, x1: x + ch.w, y: VOID_CEIL, kind: 'voiddeck' }); c.props.push({ kind: 'voiddeck', x, w: ch.w });
        for (let px = x + 260; px < x + ch.w - 150; px += 300) {
          c.tops.push({ x0: px, x1: px + 60, y0: BENCH_H, y1: BENCH_H, kind: 'bench' }); c.walls.push({ x: px, h: BENCH_H });
          c.props.push({ kind: 'planter', x: px, w: 60 });
        }
        toastArc(x + 100, x + ch.w - 100, 60, 0, 3);
        x += ch.w; break;
      }
      case 'mgr': floor(420); c.pads.push({ x0: x + 80, x1: x + 80 + MGR_W }); c.props.push({ kind: 'mgr', x: x + 80, w: MGR_W }); x += 420; break;
      case 'grate': c.grates.push({ a: x, b: x + ch.to }); c.props.push({ kind: 'grate', x }); pendingGrate = x + ch.to; break;
      case 'stall': {
        for (let i = 0; i < ch.n; i++) {
          floor(320); c.ceils.push({ x0: x + 60, x1: x + 260, y: STALL_CEIL, kind: 'stall' }); c.props.push({ kind: 'stall', x: x + 60, w: 200 });
          c.toasts.push({ x: x + 160, y: 30 }); x += 320;
        }
        break;
      }
      case 'stones': {
        c.checkpoints.push(x - 120);
        const w = ch.n * (STONE_W + STONE_GAP) + STONE_GAP;
        c.gaps.push({ x0: x, x1: x + w, water: true }); c.props.push({ kind: 'river', x, w });
        for (let i = 0; i < ch.n; i++) {
          const sx = x + STONE_GAP + i * (STONE_W + STONE_GAP);
          c.tops.push({ x0: sx, x1: sx + STONE_W, y0: STONE_H, y1: STONE_H, kind: 'stone' }); c.props.push({ kind: 'stone', x: sx, w: STONE_W });
          c.toasts.push({ x: sx + STONE_W / 2 + (STONE_W + STONE_GAP) / 2, y: 150 });
          c.checkpoints.push(sx + 20);
        }
        x += w; c.checkpoints.push(x + 60); break;
      }
    }
    if (pendingGrate !== null && x >= pendingGrate) { c.props.push({ kind: 'grate', x: pendingGrate }); pendingGrate = null; }
  }
  c.ground.unshift({ x0: -1200, x1: 0, g: 'path' });     // pavement behind the start, for the camera
  c.finish = x - 300; c.len = x + 900;
  c.ground.push({ x0: x, x1: c.len, g: 'path' });
  c.props.push({ kind: 'finish', x: c.finish }, { kind: 'landmark', x: c.finish + 420 });
  c.checkpoints.sort((a, b) => a - b);
  return c;
}
