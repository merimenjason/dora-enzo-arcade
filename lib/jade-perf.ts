// Jade Street (twelfth pass): the frame-rate fixes' arithmetic, kept apart from the scene so the Node tests can check
// it. The screen scale snaps to 1/512 (a ground chunk is 512 world units, so at a snapped scale it spans whole pixels
// and is copied to the screen pixel for pixel), and the flat screen tints (dusk, dawn, a dark night, the rain's sheen and
// dimming) fold into one fill drawn into the cached vignette. No DOM.

/** the screen scale for a device pixel ratio and zoom, snapped to 1/512 */
export const snapScale = (dpr: number, k: number) => Math.round(dpr * k * 512) / 512;
/** a run of flat fills [r, g, b, alpha] folded into one: each maps the screen D to c·a + (1 − a)·D, so together they are
 *  P + Q·D, one fill of alpha 1 − Q (rounded to 1/200, so a slow dusk does not rebuild the cache every frame) and colour
 *  P / (1 − Q). Returns the colour 'r,g,b' ('' for none) and the alpha */
export function foldTints(tints: [number, number, number, number][]): { col: string; a: number } {
  let pr = 0, pg = 0, pb = 0, q = 1;
  for (const [r, g, b, a0] of tints) { const a = Math.max(0, Math.min(1, a0)); pr = r * a + (1 - a) * pr; pg = g * a + (1 - a) * pg; pb = b * a + (1 - a) * pb; q *= 1 - a; }
  const A = Math.round((1 - q) * 200) / 200;
  return { col: A > 0 ? [pr, pg, pb].map(v => Math.round(v / (1 - q))).join(',') : '', a: A };
}
/** should a ground chunk painted at scale `have` be repainted at `want`: at once when far off (0.2 or more), otherwise
 *  only once the zoom has been still `still` seconds (0.35), so a zoom never repaints every chunk every frame */
export const chunkStale = (have: number, want: number, still: number): 'now' | 'later' | 'ok' => Math.abs(have - want) >= 0.2 ? 'now' : have !== want && still > 0.35 ? 'later' : 'ok';
