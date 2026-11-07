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
/** Each weapon's look: the blade or shaft and lantern colours, the swing's arc, and (Enzo's) the lantern's light.
 *  `lift` raises the painted brightness before the ramp (lift + (1 − lift) × l), so a shaft painted dark in a pose
 *  still comes out light. */
export const WEAPON_LOOK: Record<string, { blade?: Ramp; lift?: number; lamp?: Ramp; glint?: boolean; arc: string; light?: [number, number, number]; lightMul?: number; ring?: string }> = {
  // the bronze is polished pale, so it stands off the Reed Coat's gold in every frame as well as off the teal
  'bronze-sword': { lift: 0.2, blade: ramp([0, '#4a3018'], [0.15, '#a07040'], [0.32, '#e0b680'], [0.55, '#f8e6c8'], [0.8, '#fffaf0']), arc: 'rgba(220,250,255,0.9)' },
  'reed-cutter': { blade: ramp([0, '#0c2410'], [0.3, '#2f7a2c'], [0.55, '#6cc04a'], [0.8, '#c8f08a']), arc: 'rgba(150,240,110,0.9)' },
  moonsteel: { blade: ramp([0, '#1a2440'], [0.3, '#5a78b8'], [0.55, '#a8c8f0'], [0.8, '#eef6ff']), glint: true, arc: 'rgba(190,220,255,0.95)' },
  // Enzo's shafts are pale against his coats (the painted wood was the coat's own rust): ash-white oak, bright brass,
  // star-silver; every weapon and coat pair keeps a clear colour and lightness gap (see weaponCoatContrast)
  // (the oak's lantern is warm amber, lit, so it never reads as the rust coat's cloth either)
  'oak-staff': {
    lift: 0.18,
    blade: ramp([0, '#4a3a28'], [0.15, '#a88e68'], [0.32, '#dcc8a0'], [0.55, '#f6ead0'], [0.8, '#fffaf0']),
    lamp: ramp([0, '#2e1a0a'], [0.25, '#7a4a1c'], [0.45, '#d08a34'], [0.65, '#ffc860'], [0.85, '#fff0c0']),
    arc: 'rgba(255,214,140,0.9)', light: [1, 0.8, 0.5], lightMul: 1,
  },
  'bell-staff': {
    lift: 0.18,
    blade: ramp([0, '#6a4410'], [0.12, '#e0aa38'], [0.28, '#ffe486'], [0.5, '#fff8d0'], [0.8, '#ffffff']),
    lamp: ramp([0, '#3a2408'], [0.3, '#9a6a18'], [0.55, '#e0b040'], [0.8, '#fff2a8']),
    arc: 'rgba(255,200,90,0.95)', light: [1, 0.78, 0.4], lightMul: 1, ring: 'rgba(255,205,70,0.95)',
  },
  // the Windward Belfry's weapons: the Condor Talon's storm-white hooked blade, the Carillon Staff's pale bell-silver
  // shaft with its cyan note-light (both clear of every coat, the outfits included)
  'condor-talon': { lift: 0.1, blade: ramp([0, '#20283a'], [0.2, '#6a7c98'], [0.4, '#c4d4ea'], [0.62, '#f4f9ff'], [0.85, '#ffffff']), glint: true, arc: 'rgba(214,236,255,0.95)' },
  'carillon-staff': {
    lift: 0.18,
    blade: ramp([0, '#2a3a44'], [0.15, '#7c98a4'], [0.32, '#c4dce4'], [0.55, '#eef8fb'], [0.8, '#ffffff']),
    lamp: ramp([0, '#0a3240'], [0.3, '#1e8aa8'], [0.55, '#62e4ff'], [0.8, '#d8faff']),
    arc: 'rgba(120,236,255,0.95)', light: [0.55, 0.95, 1], lightMul: 1.2, ring: 'rgba(110,230,255,0.95)',
  },
  'star-lamp': {
    lift: 0.18,
    blade: ramp([0, '#3a4058'], [0.15, '#98a4c4'], [0.32, '#d8e0f4'], [0.55, '#f4f8ff'], [0.8, '#ffffff']),
    lamp: ramp([0, '#5a4a30'], [0.3, '#d8c890'], [0.55, '#fff6d8'], [0.8, '#ffffff']),
    arc: 'rgba(255,248,215,0.95)', light: [1, 0.97, 0.88], lightMul: 1.25,
  },
};
/** The two Windward Belfry outfits are painted whole, as their own strips (with part maps): a hero wearing one is
 *  drawn from that strip, its blade or staff recoloured as usual and the outfit left as painted. */
export const OUTFIT: Record<string, { hero: HeroId; strip: string }> = {
  'windward-jacket': { hero: 'dora', strip: 'dora-windward' },
  'highland-cloak': { hero: 'enzo', strip: 'enzo-highland' },
};
/** The strip a hero is drawn from in this coat. */
export const stripFor = (hero: HeroId, coat: string): string => (OUTFIT[coat]?.hero === hero ? OUTFIT[coat].strip : hero);
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
  // a weapon with its own colours is always repainted (Enzo's starting staff too, so it stands off his coat)
  const wl = WEAPON_LOOK[weapon]?.blade || weapon !== START_LOOK[hero].weapon ? WEAPON_LOOK[weapon] : undefined;
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
      col = along(wl.blade, wl.lift ? wl.lift + (1 - wl.lift) * l : l);
      if (wl.glint) { const g = glint.get(f); if (!g || l > g[1]) glint.set(f, [i, l]); }
    } else if (part === 3 && wl?.lamp) col = along(wl.lamp, l);
    if (col) { px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; }
  }
  for (const [i] of glint.values()) { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; }
  return coatBox;
}

/** Enzo's lantern as painted, frame by frame: the art script reads it off each raw painting (before the colour pass,
 *  which pushes the lantern, the staff and the coat to one hue) as the box round the lantern's glow with its frame and
 *  cap, and writes it into the part map's green. It takes in everything inside that box (the glass, the dark bands
 *  across it, the frame), and it never comes from the part labels, so a lantern pixel labelled coat still counts. */
export function lanternPixels(parts: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(parts.length / 4);
  for (let i = 0; i < out.length; i++) if (parts[i * 4 + 3] && parts[i * 4 + 1] > 127) out[i] = 1;
  return out;
}
/** How many of the lantern's pixels differ between two dressings of the same strip (a coat swap must leave it alone). */
export function lanternChanged(a: Uint8ClampedArray, b: Uint8ClampedArray, lamp: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < lamp.length; i++) if (lamp[i] && (a[i * 4] !== b[i * 4] || a[i * 4 + 1] !== b[i * 4 + 1] || a[i * 4 + 2] !== b[i * 4 + 2])) n++;
  return n;
}

function toLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
/** How far apart a dressed strip's weapon and coat look, frame by frame: the CIE76 colour difference (ΔE) between
 *  the mean colour of the blade or staff pixels and the mean colour of the coat pixels in each frame, and their
 *  difference in lightness (ΔL). Returns the worst frame (frames with fewer than 4 pixels of either are skipped). */
export function weaponCoatContrast(px: Uint8ClampedArray, parts: Uint8ClampedArray, w = 0, cw = 56): { dE: number; dL: number; frame: number } {
  const width = w || px.length / 4;
  const frames = Math.max(1, Math.round(width / cw));
  const sums = Array.from({ length: frames }, () => ({ 1: [0, 0, 0, 0], 2: [0, 0, 0, 0] } as Record<1 | 2, number[]>));
  for (let i = 0; i < px.length; i += 4) {
    if (!parts[i + 3] || !px[i + 3]) continue;
    const part = Math.round(parts[i] / 80);
    if (part !== 1 && part !== 2) continue;
    const x = (i / 4) % width, f = Math.min(frames - 1, Math.floor(x / cw));
    const L = toLab(px[i], px[i + 1], px[i + 2]), s2 = sums[f][part as 1 | 2];
    s2[0] += L[0]; s2[1] += L[1]; s2[2] += L[2]; s2[3]++;
  }
  let worst = { dE: Infinity, dL: Infinity, frame: -1 };
  sums.forEach((sm, f) => {
    if (sm[1][3] < 4 || sm[2][3] < 4) return;
    const a = sm[2].slice(0, 3).map((v) => v / sm[2][3]), c = sm[1].slice(0, 3).map((v) => v / sm[1][3]);
    const dE = Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]), dL = Math.abs(a[0] - c[0]);
    if (Math.min(dE / 30, dL / 15) < Math.min(worst.dE / 30, worst.dL / 15)) worst = { dE, dL, frame: f };
  });
  return worst;
}
