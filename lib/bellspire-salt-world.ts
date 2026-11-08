import type { BossId, Room } from './bellspire-world.js';

export const SALT_GATE = 'salt-gate';

type Shaft = { c: number; end: 'above' | 'below' };
export type SaltLiftPlan = { left: number; right: number; station: number; low: number; high: number; direction: 1 | -1; counter: number };

type Layout = {
  id: string;
  gx: number;
  gy: number;
  edge?: 'left' | 'right' | 'both';
  shafts?: Shaft[];
  lift?: { c: number; direction: 1 | -1; rise: number };
  solid?: [number, number, number][];
  ledges?: [number, number, number][];
  things: [number, number, string][];
  chests?: string[];
  boss?: BossId;
  ability?: Room['ability'];
};

const OUTDOOR: Layout[] = [
  { id: SALT_GATE, gx: 0, gy: 13, edge: 'right', things: [[3, 14, '?'], [8, 14, 'S'], [12, 14, ';'], [20, 14, 'A'], [34, 14, 'i'], [51, 14, 'i']], ability: 'ballast' },
  { id: 'salt-school', gx: 2, gy: 13, edge: 'both', lift: { c: 19, direction: 1, rise: 6 }, things: [[6, 14, 'i'], [10, 14, 'A'], [36, 8, 'i'], [53, 14, 'i']], ability: 'catch' },
  { id: 'salt-pans', gx: 4, gy: 13, edge: 'both', solid: [[16, 8, 14], [28, 8, 14], [39, 7, 14]], ledges: [[27, 5, 9], [47, 8, 9]], things: [[9, 14, '5'], [18, 12, 'i'], [30, 11, '6'], [49, 8, 'C']], chests: ['gear:dora-salt-coat'] },
  { id: 'salt-weighhouse', gx: 6, gy: 13, edge: 'left', shafts: [{ c: 54, end: 'below' }], things: [[2, 14, 'b'], [10, 14, 'i'], [31, 14, 'O'], [47, 14, 'i']], boss: 'weighmaster' },
  { id: 'salt-ridge', gx: 6, gy: 14, edge: 'left', shafts: [{ c: 54, end: 'above' }], lift: { c: 22, direction: -1, rise: 5 }, things: [[6, 14, 'i'], [11, 14, '5'], [40, 14, 'i'], [46, 14, '6']] },
  { id: 'salt-moonpan', gx: 4, gy: 14, edge: 'right', shafts: [{ c: 5, end: 'below' }], ledges: [[22, 9, 10], [37, 7, 8], [46, 10, 11]], things: [[10, 14, 'i'], [23, 8, 'C'], [37, 14, '5'], [50, 14, 'i']], chests: ['drop'] },
];

const GALLERIES: Layout[] = [
  { id: 'salt-mulegate', gx: 4, gy: 15, edge: 'left', shafts: [{ c: 5, end: 'above' }], ledges: [[20, 10, 13], [39, 6, 11]], things: [[10, 14, 'i'], [19, 14, 'S'], [32, 14, '7'], [41, 10, 'C'], [53, 14, 'i']], chests: ['gear:enzo-salt-coat'] },
  { id: 'salt-ropes', gx: 2, gy: 15, edge: 'both', lift: { c: 20, direction: -1, rise: 6 }, things: [[7, 14, 'i'], [38, 8, 'i'], [47, 14, '7'], [55, 14, '8']] },
  { id: 'salt-panback', gx: 0, gy: 15, edge: 'right', shafts: [{ c: 5, end: 'below' }], things: [[56, 14, 'b'], [14, 14, 'i'], [31, 14, 'O'], [48, 14, 'i']], boss: 'panback' },
  { id: 'salt-deep-haul', gx: 0, gy: 16, edge: 'right', shafts: [{ c: 5, end: 'above' }], lift: { c: 21, direction: 1, rise: 7 }, things: [[11, 14, 'i'], [37, 7, 'i'], [53, 14, '8']] },
  { id: 'salt-toll-road', gx: 2, gy: 16, edge: 'both', solid: [[13, 8, 14], [25, 7, 14], [37, 6, 14]], ledges: [[11, 7, 12], [34, 6, 12]], things: [[5, 14, 'i'], [18, 12, '8'], [35, 5, '7'], [48, 14, 'S'], [55, 14, 'i']] },
  { id: 'salt-tollhouse', gx: 4, gy: 16, edge: 'left', things: [[2, 14, 'b'], [10, 14, 'i'], [31, 14, 'O'], [49, 14, 'i']], boss: 'tollkeeper' },
];

function buildRoom(plan: Layout, area: 'salt' | 'haul'): Room {
  const rows: string[][] = Array.from({ length: 17 }, (_, r) => Array.from({ length: 60 }, (_, c) => r < 2 || r >= 15 || c === 0 || c === 59 ? '#' : '.'));
  const put = (c: number, r: number, ch: string) => { rows[r][c] = ch; };
  const fill = (x0: number, y0: number, x1: number, y1: number, ch: string) => {
    for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) put(c, r, ch);
  };
  if (plan.edge === 'left' || plan.edge === 'both') fill(0, 12, 0, 14, '.');
  if (plan.edge === 'right' || plan.edge === 'both') fill(59, 12, 59, 14, '.');
  for (const [c, w, r] of plan.solid ?? []) fill(c, r, c + w - 1, 14, '#');
  for (const [c, w, r] of plan.ledges ?? []) fill(c, r, c + w - 1, r, '=');
  for (const s of plan.shafts ?? []) {
    const top = s.end === 'above' ? 0 : 13, bottom = s.end === 'above' ? 14 : 16;
    fill(s.c - 1, top, s.c + 1, bottom, '.');
    fill(s.c, top, s.c, bottom, 'H');
    if (s.end === 'below' && plan.boss) fill(s.c - 1, 15, s.c + 1, 15, '>');
  }
  let saltLift: SaltLiftPlan | undefined;
  if (plan.lift) {
    const { c, direction, rise } = plan.lift;
    const col = (n: number) => direction === 1 ? n : 59 - n;
    const span = (a: number, b: number, y0: number, y1: number, ch: string) => fill(Math.min(col(a), col(b)), y0, Math.max(col(a), col(b)), y1, ch);
    const top = 15 - rise;
    span(c, c + 8, 15, 15, '.');
    span(c + 9, c + 17, top, 14, '#');
    for (let n = 0; n < rise - 1; n++) span(c + 18 + n, c + 18 + n, top + n + 1, 14, '#');
    const left = Math.min(col(c), col(c + 8)) * 16;
    const right = left + 9 * 16;
    saltLift = { left, right, low: 240, high: top * 16, station: col(c - 3) * 16 + 8, direction, counter: col(c + 13) * 16 + 8 };
  }
  for (const [c, r, ch] of plan.things) {
    if (rows[r][c] === '#') {
      if (ch !== 'i' && ch !== '5' && ch !== '6' && ch !== '7' && ch !== '8') throw new Error(`Salt Road object in rock: ${plan.id} ${c},${r}`);
      continue;
    }
    if (ch === 'b') fill(c, 12, c, 14, 'b');
    else put(c, r, ch);
  }
  return { id: plan.id, area, gx: plan.gx, gy: plan.gy, w: 2, h: 1, rows: rows.map((r) => r.join('')), exp: true,
    salt: true, saltLift, chests: plan.chests, boss: plan.boss, ability: plan.ability, dark: area === 'haul' };
}

export function saltRooms() {
  return [...OUTDOOR.map((r) => buildRoom(r, 'salt')), ...GALLERIES.map((r) => buildRoom(r, 'haul'))];
}
