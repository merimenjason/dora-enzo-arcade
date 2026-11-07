// The Sunken Bellspire: how gear looks. Weapons and coats are painted into every hero frame, so the worn ones are
// shown by recolouring those pixels: scripts/bellspire-art.py writes a part map beside each hero strip
// (<hero>-parts.webp: red 80 the coat, 160 Dora's blade or Enzo's staff shaft, 240 Enzo's lantern), and each part is
// repainted along a colour ramp by the brightness it was painted with. The starting gear keeps its painted colours.
// Pure (no DOM): the scene and the gear menu both use it.
import type { HeroId } from './bellspire-world.js';

type Ramp = [number, [number, number, number]][];
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (...s: [number, string][]): Ramp => s.map(([k, c]) => [k, hex(c)]);

/** Each coat's colours (by brightness), and an extra touch: the reed coat's weave, the snail coat's shell. */
export const COAT_LOOK: Record<string, { ramp: Ramp; weave?: boolean; shell?: boolean }> = {
  'teal-coat': { ramp: ramp([0, '#06201f'], [0.2, '#0d4f4c'], [0.4, '#14827e'], [0.6, '#3cbcb2'], [0.85, '#a6efe4']) },
  'rust-coat': { ramp: ramp([0, '#2a0f08'], [0.2, '#6a2c18'], [0.4, '#a4502f'], [0.6, '#d27a4c'], [0.85, '#f5c09a']) },
  'reed-coat': { ramp: ramp([0, '#3a2a08'], [0.2, '#7a5a1a'], [0.4, '#c09a3a'], [0.6, '#e6c86a'], [0.85, '#fff0b8']), weave: true },
  'snail-coat': { ramp: ramp([0, '#1e140c'], [0.2, '#4a3220'], [0.4, '#7a5634'], [0.6, '#a8805a'], [0.85, '#e0c4a0']), shell: true },
};
/** Each weapon's look: the blade or shaft and lantern colours, the swing's arc, and (Enzo's) the lantern's light. */
export const WEAPON_LOOK: Record<string, { blade?: Ramp; lamp?: Ramp; glint?: boolean; arc: string; light?: [number, number, number]; lightMul?: number; ring?: string }> = {
  'bronze-sword': { arc: 'rgba(220,250,255,0.9)' },
  'reed-cutter': { blade: ramp([0, '#0c2410'], [0.3, '#2f7a2c'], [0.55, '#6cc04a'], [0.8, '#c8f08a']), arc: 'rgba(150,240,110,0.9)' },
  moonsteel: { blade: ramp([0, '#1a2440'], [0.3, '#5a78b8'], [0.55, '#a8c8f0'], [0.8, '#eef6ff']), glint: true, arc: 'rgba(190,220,255,0.95)' },
  'oak-staff': { arc: 'rgba(255,214,140,0.9)', light: [1, 0.8, 0.5], lightMul: 1 },
  'bell-staff': {
    blade: ramp([0, '#2a1606'], [0.25, '#6a4012'], [0.45, '#b07a2a'], [0.65, '#e0b050'], [0.9, '#fff0a0']),
    lamp: ramp([0, '#3a2408'], [0.3, '#9a6a18'], [0.55, '#e0b040'], [0.8, '#fff2a8']),
    arc: 'rgba(255,200,90,0.95)', light: [1, 0.78, 0.4], lightMul: 1, ring: 'rgba(255,205,70,0.95)',
  },
  'star-lamp': {
    lamp: ramp([0, '#5a4a30'], [0.3, '#d8c890'], [0.55, '#fff6d8'], [0.8, '#ffffff']),
    arc: 'rgba(255,248,215,0.95)', light: [1, 0.97, 0.88], lightMul: 1.25,
  },
};
export const START_LOOK: Record<HeroId, { weapon: string; coat: string }> = {
  dora: { weapon: 'bronze-sword', coat: 'teal-coat' }, enzo: { weapon: 'oak-staff', coat: 'rust-coat' },
};

function along(r: Ramp, l: number): [number, number, number] {
  if (l <= r[0][0]) return r[0][1];
  for (let i = 1; i < r.length; i++) if (l <= r[i][0]) {
    const [k0, c0] = r[i - 1], [k1, c1] = r[i], t = (l - k0) / (k1 - k0);
    return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
  }
  return r[r.length - 1][1];
}

/** Recolour a hero strip's pixels (RGBA, `w` wide, cells `cw` wide) in place for the worn weapon and coat. `parts` is
 *  the part map's RGBA. Returns, per frame, where the coat's back is (for the snail coat's shell), or null. */
export function dressStrip(px: Uint8ClampedArray, parts: Uint8ClampedArray, w: number, h: number, cw: number, hero: HeroId, weapon: string, coat: string) {
  const c = coat !== START_LOOK[hero].coat ? COAT_LOOK[coat] : undefined;
  const wl = weapon !== START_LOOK[hero].weapon ? WEAPON_LOOK[weapon] : undefined;
  const n = Math.round(w / cw);
  // the brightest blade pixel of each frame gets the Moonsteel's glint
  const glint = new Map<number, [number, number]>();
  const coatBox: ({ x0: number; x1: number; y0: number; y1: number } | null)[] = Array.from({ length: n }, () => null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (parts[i + 3] === 0 || px[i + 3] === 0) continue;
    const part = Math.round(parts[i] / 80), f = Math.floor(x / cw);
    const l = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255;
    let col: [number, number, number] | null = null;
    if (part === 1) {
      const bx = coatBox[f] ?? (coatBox[f] = { x0: x, x1: x, y0: y, y1: y });
      bx.x0 = Math.min(bx.x0, x); bx.x1 = Math.max(bx.x1, x); bx.y0 = Math.min(bx.y0, y); bx.y1 = Math.max(bx.y1, y);
      if (c) { col = along(c.ramp, l); if (c.weave && y % 3 === 0) col = [col[0] * 0.78, col[1] * 0.74, col[2] * 0.7]; }
    } else if (part === 2 && wl?.blade) {
      col = along(wl.blade, l);
      if (wl.glint) { const g = glint.get(f); if (!g || l > g[1]) glint.set(f, [i, l]); }
    } else if (part === 3 && wl?.lamp) col = along(wl.lamp, l);
    if (col) { px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; }
  }
  for (const [i] of glint.values()) { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; }
  return coatBox;
}
