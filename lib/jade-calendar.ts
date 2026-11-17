// Jade Street: the festivals follow the calendar (owner, 16-11-2026). The page tells the world today's date from the
// device (World.today, 'yyyy-mm-dd'); the engine never reads a clock itself, so a test without a date keeps the old
// turn-about by night and replays exactly. Deepavali's light-up runs three weeks before the day to a week after, the
// Hari Raya bazaar the month of Ramadan up to three days after Hari Raya Puasa, and the Orchard Road Christmas light-up
// from 15 November to 4 January. Out of season a festival's street is quiet (its stalls shut, its lamps dark).
// Dates are Singapore's public holidays. No DOM.

/** Deepavali and Hari Raya Puasa (the first of Syawal), by year */
export const DEEPAVALI: Record<number, string> = { 2025: '10-20', 2026: '11-08', 2027: '10-28', 2028: '10-17', 2029: '11-05', 2030: '10-26', 2031: '11-14', 2032: '11-02' };
export const HARI_RAYA: Record<number, string> = { 2025: '03-31', 2026: '03-21', 2027: '03-10', 2028: '02-27', 2029: '02-15', 2030: '02-05', 2031: '01-25', 2032: '01-14' };
/** the windows round each day, in days (from, to) */
/** the Mid-Autumn Festival (the fifteenth of the eighth lunar month), by year: Lights by the Lake at Jurong Lake Gardens */
export const MID_AUTUMN: Record<number, string> = { 2025: '10-06', 2026: '09-25', 2027: '09-15', 2028: '10-03', 2029: '09-22', 2030: '09-12', 2031: '10-01', 2032: '09-19' };
export const SEASON = { deepavali: [-21, 7], bazaar: [-30, 3], midAutumn: [-14, 7] } as const;

const DAY = 86400000;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
/** today as 'yyyy-mm-dd' from a Date (the page passes the device's local date) */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** days from the nearest listed festival day to today (negative before it), or null with no table entry near */
function offset(today: string, table: Record<number, string>): number | null {
  const t = parse(today), y = +today.slice(0, 4); let best: number | null = null;
  for (const yy of [y - 1, y, y + 1]) { const md = table[yy]; if (!md) continue; const off = Math.round((t - parse(`${yy}-${md}`)) / DAY); if (best === null || Math.abs(off) < Math.abs(best)) best = off; }
  return best;
}
const within = (off: number | null, [a, b]: readonly [number, number]) => off !== null && off >= a && off <= b;
export const isDeepavali = (today: string) => within(offset(today, DEEPAVALI), SEASON.deepavali);
export const isBazaar = (today: string) => within(offset(today, HARI_RAYA), SEASON.bazaar);
/** the Orchard Road light-up: 15 November to 4 January */
export const isChristmas = (today: string) => { const md = today.slice(5); return md >= '11-15' || md <= '01-04'; };
/** Lights by the Lake: two weeks before the Mid-Autumn Festival to a week after */
export const isMidAutumn = (today: string) => within(offset(today, MID_AUTUMN), SEASON.midAutumn);
