// Jade Street: the seeded random generator (mulberry32) and string hash shared by the city builder, the markets,
// traffic, missions and the daily event. Everything in the engine draws from these so a seed replays exactly.
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** a stable 32-bit hash of a string */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** smallest signed difference between two angles */
export const angDiff = (a: number, b: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
