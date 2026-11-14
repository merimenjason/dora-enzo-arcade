// Jade Street: passing rain showers. Each night has none, one or two showers at seeded times (the same for a seed and
// night every time, so the engine stays deterministic); a shower swells over a few game minutes, rains, and fades.
// Rain wets the streets (the scene adds streaks, ripples and reflections), sends townsfolk under umbrellas and fills
// the soundscape; it doesn't change how anything moves.
import { rng, hashStr, clamp } from './jade-rng.js';

export type Shower = { at: number; len: number; k: number };
const cache = new Map<string, Shower[]>();
export function showers(seed: number, night: number): Shower[] {
  const key = seed + ':' + night; let s = cache.get(key);
  if (!s) {
    const R = rng(hashStr('jade-rain:' + key));
    const n = R() < 0.3 ? 0 : R() < 0.65 ? 1 : 2; s = [];
    for (let i = 0; i < n; i++) s.push({ at: 40 + R() * 560 + i * 40, len: 45 + R() * 70, k: 0.55 + R() * 0.45 });
    cache.set(key, s); if (cache.size > 64) cache.delete(cache.keys().next().value!);
  }
  return s;
}
/** rain from 0 (dry) to 1 (a downpour) at this moment of the night */
export function rainAt(seed: number, night: number, clock: number): number {
  let r = 0;
  for (const sh of showers(seed, night)) {
    const t = clock - sh.at; if (t < 0 || t > sh.len) continue;
    r = Math.max(r, sh.k * clamp(Math.min(t, sh.len - t) / 8, 0, 1));
  }
  return r;
}
