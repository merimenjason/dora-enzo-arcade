// Jade Street: drawing the city (Canvas 2D). The ground, decals, building blocks and ground-level props are baked into
// 8×8-tile chunk canvases on demand (an LRU keeps ~40), so a frame draws a dozen chunk images plus only the moving
// and tall things on screen, y-sorted: stalls, lamps, trees, rides, traffic, townsfolk, wardens, crows and the hero.
// Code draws only light and effects: lamp glows, the route line, torch beams, the blimp's spotlight, fog over locked
// districts, dust and sparkles; game feel (shake, hit-stop, debris, speed lines) is in lib/jade-juice.ts and the set
// pieces, the finale and the business stalls are drawn by lib/jade-setdraw.ts. Every picture is a Codex painting from the atlases in public/art/jade-street/.
import { FRAMES, ATLASES, VER } from './jade-art.js';
import { EAGER, ART_BUDGET, decodedBytes } from './jade-load.js';
import { T, W, H, G, OW, CT_H, EAST_X0, EAST_SPLIT, FAR_X0, FAR_SPLIT, CHANGI_X0, SOUTH_X0, SOUTH_X1, TIONG_X0, QUAY_X0, UBIN_X0, UBIN_X1, UBIN_Y0, GROUND_NAMES, F_ROOF, districtAt, type City, type District } from './jade-city.js';
import { unmvT } from './jade-layout.js';
import { F_XWAY } from './jade-island.js';
import { VEHICLES, onWater, AS_PAINTED } from './jade-move.js';
import { tagOption, grabTarget } from './jade-tag.js';
import type { World, Ride } from './jade-game.js';
import type { Actor } from './jade-mission.js';
import { OUTFITS, PAINTS } from './jade-save.js';
import { lanterns } from './jade-heat.js';
import { Life } from './jade-life.js';
import { Juice } from './jade-juice.js';
import { setGround, setSorted, drawDecoy, realGlint } from './jade-setdraw.js';
import { sgGround, sgSorted, sgOver, sgFlash } from './jade-sgdraw.js';
import { drawHero, gearGround, gearSorted, gearOver, wardenHitFrame, aimLine, setItemSprite } from './jade-duodraw.js';
import { shooterFor } from './jade-gear.js';
import { isleSorted, isleOver, isleActor, isleGround } from './jade-isledraw.js';
import { eastGround, eastSorted, eastOver } from './jade-eastdraw.js';
import { farSorted, farOver } from './jade-fardraw.js';
import { southGround, southSorted, southOver } from './jade-southdraw.js';
import { ubinSorted } from './jade-ubindraw.js';
import { snapScale, foldTints, chunkStale } from './jade-perf.js';
import { empSorted, empOver, jagaActor } from './jade-empdraw.js';
import { BIZ, BIZ_OF, bizPos } from './jade-biz.js';
import { jobActor, jobGround, mindBeam, mindBubble } from './jade-jobdraw.js';
import { castFrame, castPose, type CastMember } from './jade-cast.js';

export const ART = '/art/jade-street/';
const CH = 8; // tiles per chunk
/** a decoded painting: an ImageBitmap (closed when let go, so its pixels are freed at once), or an image element where
 *  the browser has no createImageBitmap */
type Pic = ImageBitmap | HTMLImageElement;
const images: Record<string, Pic> = {};

// ── loading (which file when is lib/jade-load.ts). Each atlas and ground texture is loaded and decoded on its own,
// by the loading bar (`ensureArt`), when the world needs it now (`ensureArt` again, from the page's controller), or in
// the background (`streamArt`: a couple at a time, decoded, then the rest fetched into the browser's cache only). A
// file nothing has drawn from for a while is let go (`releaseArt`), so its decoded pixels can be freed. `artGen`
// counts arrivals: the scene repaints any ground chunk that was painted while one of its pictures was missing.
/** a file's URL: the content hash from the packer as a query, so the art can be cached for a year (public/_headers) */
export const artUrl = (n: string, base = ART) => `${base}${n}.webp${VER[n] ? '?v=' + VER[n] : ''}`;
type Slot = { im: Pic | null; ok: boolean; p: Promise<boolean> };
const slots = new Map<string, Slot>();
export let artGen = 0;
/** when each file was last drawn from (performance.now, ms): atlases by index, refreshed once a frame for speed */
const usedAt = new Map<string, number>(); const usedAtlas = new Float64Array(ATLASES.length); let drawClock = 0;
/** files a draw asked for that were not in; the controller loads them at once */
export const artMissing = new Set<string>();
/** set by src() and pattern() when a picture was missing, so a chunk painted without it is repainted later */
let missed = false;
/** the maps paint the whole island: a picture missing there is not asked for (it would pull in every district) */
let quietMiss = false;
/** was a picture missing since the last call (for a canvas painted outside the scene, such as the painted map) */
export const takeMissed = () => { const m = missed; missed = false; return m; };
/** the minimap's map: strip width (px), columns painted at a time, and ms of painting a frame */
const MAP_STRIP = 840, MAP_COLS = 6, MAP_BUDGET = 2.5;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
function loadOne(n: string, base = ART): Promise<boolean> {
  const have = slots.get(n); if (have) return have.p;
  const slot: Slot = { im: null, ok: false, p: Promise.resolve(false) };
  const done = (im: Pic | null) => {
    if (slots.get(n) !== slot) { if (im && 'close' in im) im.close(); return false; } // let go while it was on its way
    if (!im) { slots.delete(n); return false; }
    slot.im = im; slot.ok = true; images[n] = im; usedAt.set(n, now()); artMissing.delete(n); artGen++; return true;
  };
  const url = artUrl(n, base);
  if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
    slot.p = fetch(url).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); }).then(b => createImageBitmap(b).then(im => { void b.size; return im; })).then(done, () => done(null)); // (the blob is held until the bitmap is made: WebKit loads it by URL)
  } else {
    slot.p = new Promise<boolean>(res => {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).catch(() => undefined).then(() => res(done(im))); };
      im.onerror = () => res(done(null));
      im.src = url;
    });
  }
  slots.set(n, slot);
  return slot.p;
}
/** the decoded bytes held now and on their way (the background queue keeps this under ART_BUDGET) */
const residentBytes = () => { let b = 0; for (const n of slots.keys()) b += decodedBytes(n); return b; };
export const artReady = (n: string) => !!slots.get(n)?.ok;
/** a file being fetched for the canvas right now (its promise), or null: an interface sprite from it waits for that
 * download rather than starting a second one as a CSS background, which the browser aborted (ERR_ABORTED) and fetched
 * again whenever the hero pick unmounted mid-load (pass 13) */
export const artPending = (n: string): Promise<boolean> | null => { const sl = slots.get(n); return sl && !sl.ok ? sl.p : null; };
/** load and decode these files (each at most once at a time); `progress` gets (done, total); rejects with the files
 *  that failed */
export function ensureArt(names: string[], progress?: (done: number, total: number) => void, base = ART): Promise<void> {
  let done = names.filter(artReady).length; const failed: string[] = [];
  progress?.(done, names.length);
  return Promise.all(names.filter(n => !artReady(n)).map(n => loadOne(n, base).then(ok => { if (!ok) failed.push(n); done++; progress?.(done, names.length); })))
    .then(() => { if (failed.length) throw new Error('Could not load: ' + failed.join(', ')); });
}
/** the eager set: everything the title and a night in Chinatown draw (the loading bar waits for this) */
export function loadArt(base = ART, progress?: (done: number, total: number) => void): Promise<void> {
  return ensureArt(EAGER, progress, base);
}
export const artLoaded = () => EAGER.every(artReady);
/** a full-screen painting shown as an <img> or a CSS background (the title, the opening storybook): fetched and decoded
 * ahead of time, and the Image kept so the browser keeps it decoded (pass 13: the opening's first panel stayed black
 * for seconds on a slow connection, because nothing had asked for it) */
const pics = new Map<string, { im: HTMLImageElement; ok: boolean; p: Promise<boolean> }>();
export function preloadPic(n: string, base = ART): Promise<boolean> {
  const have = pics.get(n); if (have) return have.p;
  if (typeof Image === 'undefined') return Promise.resolve(false);
  const im = new Image(); im.decoding = 'async';
  const e = { im, ok: false, p: Promise.resolve(false) };
  e.p = new Promise<boolean>(res => {
    im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).catch(() => undefined).then(() => { e.ok = true; res(true); }); };
    im.onerror = () => { pics.delete(n); res(false); };
  });
  im.src = artUrl(n, base); pics.set(n, e); return e.p;
}
export const picReady = (n: string) => !!pics.get(n)?.ok;
/** the opening storybook's first painting: a new game waits for it with the eager set */
export const STORY_FIRST = 'bg-story-1';
/** the background queue: decode `decode` two at a time, then fetch `prefetch` into the HTTP cache one at a time */
let queue: { n: string; decode: boolean }[] = []; let busy = 0; const fetched = new Set<string>();
export function streamArt(decode: string[], prefetch: string[]) {
  queue = [...decode.filter(n => !slots.has(n)).map(n => ({ n, decode: true })), ...prefetch.filter(n => !slots.has(n) && !fetched.has(n)).map(n => ({ n, decode: false }))];
  pump();
}
function pump() {
  while (busy < 2 && queue.length) {
    const { n, decode } = queue.shift()!;
    if (decode ? slots.has(n) : fetched.has(n) || slots.has(n)) continue;
    // past the budget a nearby zone is only fetched: it is decoded when the heroes get there
    if (decode && residentBytes() + decodedBytes(n) > ART_BUDGET) { if (!fetched.has(n)) queue.unshift({ n, decode: false }); continue; }
    busy++;
    const next = () => { busy--; setTimeout(pump, 120); };
    if (decode) loadOne(n).then(next);
    else { fetched.add(n); (typeof fetch === 'function' ? fetch(artUrl(n)).then(r => r.arrayBuffer()) : Promise.resolve()).catch(() => fetched.delete(n)).then(next); }
  }
}
/** files decoded now, with the seconds since each was last drawn from */
export const artResident = () => { const t = now(); return [...slots.entries()].filter(([, s]) => s.ok).map(([n]) => { const ai = (ATLASES as readonly string[]).indexOf(n); return { n, idle: (t - Math.max(usedAt.get(n) ?? 0, ai >= 0 ? usedAtlas[ai] : 0)) / 1000 }; }); };
/** let decoded files go: their pixels can be freed, and recoloured copies cut from them too */
export function releaseArt(names: string[]) {
  for (const n of names) {
    const s = slots.get(n); if (!s) continue;
    slots.delete(n); delete images[n];
    if (s.im && 'close' in s.im) s.im.close(); else if (s.im) { s.im.onload = s.im.onerror = null; s.im.removeAttribute('src'); }
    const ai = (ATLASES as readonly string[]).indexOf(n);
    if (ai >= 0) for (const k of [...recolored.keys()]) { const f = FRAMES[k.split('|')[0]]; if (f && f[0] === ai) { const c = recolored.get(k)!; c.width = c.height = 0; recolored.delete(k); } }
  }
}
/** empty a canvas, so its pixels are freed now rather than whenever it is collected */
const freeCanvas = (c: HTMLCanvasElement) => { c.width = 0; c.height = 0; };
/** a canvas's 2D context, or null when the browser will not make one (WebKit refuses past its canvas memory cap) */
export function ctx2d(c: HTMLCanvasElement, o?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D | null {
  try { return c.getContext('2d', o) as CanvasRenderingContext2D | null; } catch { return null; }
}

// ── sprite drawing
type Frame = [number, number, number, number, number];
const recolored = new Map<string, HTMLCanvasElement>();
const RECOLOR_MAX = 360;
export const recoloredCount = () => recolored.size;
function hueShift(src: Pic | HTMLCanvasElement, f: Frame, test: (h: number, s: number, v: number) => boolean, deg: number): HTMLCanvasElement | null {
  const c = document.createElement('canvas'); c.width = f[3]; c.height = f[4];
  const x = ctx2d(c, { willReadFrequently: true }); if (!x) return null;
  x.drawImage(src, f[1], f[2], f[3], f[4], 0, 0, f[3], f[4]);
  if (!deg) return c;
  const d = x.getImageData(0, 0, c.width, c.height); const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 10) continue;
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
    if (dl < 1e-3) continue;
    let h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h *= 60; if (h < 0) h += 360;
    const s = dl / mx, v = mx;
    if (!test(h, s, v)) continue;
    h = (h + deg) % 360;
    const C = v * s, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - C;
    let rr = 0, gg = 0, bb = 0;
    if (h < 60) [rr, gg, bb] = [C, X, 0]; else if (h < 120) [rr, gg, bb] = [X, C, 0]; else if (h < 180) [rr, gg, bb] = [0, C, X]; else if (h < 240) [rr, gg, bb] = [0, X, C]; else if (h < 300) [rr, gg, bb] = [X, 0, C]; else [rr, gg, bb] = [C, 0, X];
    p[i] = (rr + m) * 255; p[i + 1] = (gg + m) * 255; p[i + 2] = (bb + m) * 255;
  }
  x.putImageData(d, 0, 0); return c;
}
const OUTFIT_HUE: Record<string, number> = { classic: 0, midnight: 1, temple: 2, canal: 3, harbour: 4, neon: 5 };
const DORA_TO = [0, 75, -100, 30, 140, 170], ENZO_TO = [0, 220, 40, 175, 270, 305];
/** the image and source rect for a frame, recoloured for outfits (hero jackets) and paint (rides) */
function src(name: string, variant = ''): [Pic | HTMLCanvasElement, number, number, number, number] | null {
  const f = FRAMES[name] as Frame | undefined; if (!f) return null;
  const an = ATLASES[f[0]], im = images[an];
  if (!im) { missed = true; if (!quietMiss) artMissing.add(an); return null; }
  usedAtlas[f[0]] = drawClock;
  if (!variant) return [im, f[1], f[2], f[3], f[4]];
  const [kind, v] = variant.split(':');
  const deg = kind === 'dora' ? (DORA_TO[+v] + 360) % 360 : kind === 'enzo' ? (ENZO_TO[+v] + 360) % 360 : +v;
  if (!deg) return [im, f[1], f[2], f[3], f[4]]; // the classic jacket and an unpainted ride are the painting itself
  const key = name + '|' + variant;
  let c = recolored.get(key);
  if (c) { recolored.delete(key); recolored.set(key, c); } // most recently used last
  else {
    const made = kind === 'dora' ? hueShift(im, f, (h, s, val) => h > 95 && h < 185 && s > 0.25 && val > 0.12, deg)
      : kind === 'enzo' ? hueShift(im, f, (h, s, val) => (h < 18 || h > 345) && s > 0.55 && val > 0.3, deg)
      : hueShift(im, f, (h, s) => s > 0.35 && !(h > 30 && h < 60 && s < 0.5), deg);
    if (!made) return [im, f[1], f[2], f[3], f[4]];
    c = made; recolored.set(key, c);
    // at most RECOLOR_MAX recoloured frames (a few dozen MB at most): the least recently drawn go first
    while (recolored.size > RECOLOR_MAX) { const [k0, c0] = recolored.entries().next().value!; freeCanvas(c0); recolored.delete(k0); }
  }
  return [c, 0, 0, f[3], f[4]];
}
/** draw a sprite: (x, y) is the anchor (feet for 'bottom', middle for 'center'); `w` world width (default natural size) */
export function spr(x: CanvasRenderingContext2D, name: string, px: number, py: number, o: { w?: number; h?: number; anchor?: 'bottom' | 'center'; rot?: number; flip?: boolean; alpha?: number; variant?: string; sx?: number } = {}) {
  const s = src(name, o.variant); if (!s) return false;
  const [im, sx, sy, sw, sh] = s;
  let w = sw / 2, h = sh / 2;
  if (o.w && o.h) { w = o.w; h = o.h; } else if (o.w) { h = h * o.w / w; w = o.w; } else if (o.h) { w = w * o.h / h; h = o.h; }
  w *= o.sx ?? 1;
  const a = o.anchor ?? 'bottom';
  const rot = o.rot ?? 0;
  if (o.alpha !== undefined) x.globalAlpha = o.alpha;
  if (rot || o.flip) {
    x.save(); x.translate(px, py); if (rot) x.rotate(rot); if (o.flip) x.scale(-1, 1);
    x.drawImage(im, sx, sy, sw, sh, -w / 2, a === 'bottom' ? -h : -h / 2, w, h); x.restore();
  } else x.drawImage(im, sx, sy, sw, sh, px - w / 2, a === 'bottom' ? py - h : py - h / 2, w, h);
  if (o.alpha !== undefined) x.globalAlpha = 1;
  return true;
}
/** is a frame drawable now (its atlas decoded)? A frame not yet loaded is asked for, so it shows a moment later */
export function hasFrame(name: string): boolean {
  const f = FRAMES[name] as Frame | undefined; if (!f) return false;
  const an = ATLASES[f[0]]; if (images[an]) return true;
  artMissing.add(an); return false;
}
export const frameSize = (name: string) => { const f = FRAMES[name]; return f ? [f[3] / 2, f[4] / 2] : [0, 0]; };

// ── the hero's frame for an animation
export function heroFrame(h: string, anim: string, face: 'down' | 'up' | 'side', t: number): string {
  const cyc = (n: number, fps: number) => Math.floor(t * fps) % n;
  switch (anim) {
    case 'walk': return `${h}-walk-${face}-${cyc(4, 7)}`;
    case 'run': return `${h}-run-${face}-${cyc(4, 11)}`;
    case 'sneak': return face === 'side' ? `${h}-sneak` : `${h}-walk-${face}-${cyc(4, 4)}`;
    case 'dash': return `${h}-dash-${face}`;
    case 'hop': return `${h}-hop-${face}`;
    case 'bump': return `${h}-bump`;
    case 'pickup': return `${h}-pickup`;
    case 'hide': return `${h}-hide`;
    case 'carry': case 'carry-idle': return face === 'side' ? `${h}-carry-side` : `${h}-carry-down`;
    case 'climb-on': return `${h}-climb-on`;
    case 'climb-off': return `${h}-climb-off`;
    case 'celebrate': return `${h}-cheer-${cyc(2, 4)}`;
    case 'caught': return t < 0.6 ? `${h}-caught-0` : `${h}-caught-1`;
    case 'swap': return `${h}-swap`;
    case 'sleep': return `${h}-sleep`;
    case 'paint': return `${h}-paint-${cyc(2, 4)}`;
    case 'lockpick': return `${h}-pick-${cyc(2, 3)}`;
    case 'enter-door': return `${h}-door`;
    case 'climb': return `${h}-hop-up`;
    case 'talk': return `${h}-talk`;
    case 'wave': return `${h}-wave`;
    case 'barge': return face === 'side' ? `${h}-barge-side` : `${h}-barge-down`;
    case 'push': return face === 'up' ? `${h}-push-up-${cyc(2, 4)}` : `${h}-push-side-${cyc(2, 4)}`;
    case 'umbrella': return face === 'down' ? `${h}-umbrella` : `${h}-walk-${face}-${cyc(4, 7)}`;
    case 'phone': return `${h}-phone`;
    case 'eat': return `${h}-eat`;
    case 'dance': return t % 0.8 < 0.4 ? `${h}-dance` : `${h}-cheer-${cyc(2, 4)}`;
    case 'kneel': return `${h}-kneel`;
    case 'clap': return t % 0.5 < 0.25 ? `${h}-clap` : `${h}-wave`;
    case 'lantern': return `${h}-lantern`;
    case 'look-up': return `${h}-lookup`;
    case 'leap': return `${h}-leap-${t < 0.22 ? 0 : 1}`;
    case 'land': return `${h}-land`;
    case 'duck': return `${h}-duck`;
    case 'shoo': return `${h}-shoo-${cyc(2, 7)}`;
    case 'collect': return t < 0.5 ? `${h}-collect` : `${h}-pocket`;
    case 'pocket': return `${h}-pocket`;
    case 'deal': return `${h}-deal`;
    case 'mend': return `${h}-mend`;
    case 'skid': return `${h}-skid`;
    case 'tumble': return `${h}-tumble`;
    // the island: hailing a taxi, tapping a fare card at the gates, the train's handrail, out of breath after beating
    // the train, pointing the taxi on its way, the playground slide, the Island Night dance
    case 'hail': return face === 'side' ? `${h}-hail-side` : `${h}-hail-down`;
    case 'tap-card': return `${h}-tap-card`;
    case 'pole': return `${h}-pole-${cyc(2, 2)}`;
    case 'seat': return `${h}-seat`;
    case 'panting': return `${h}-panting`;
    case 'point': return `${h}-point`;
    case 'slide': return `${h}-slide`;
    case 'isle-dance': return `${h}-dance-${cyc(2, 3)}`;
    // over the Rochor River and on Sentosa: lighting a Deepavali lamp, a kuih at the bazaar, covering the ears at a
    // mynah's racket, smelling the spices or the attar, a deck chair on the beach, building a sandcastle
    case 'light-lamp': return `${h}-light-lamp-${t < 0.6 ? 0 : 1}`;
    case 'kuih': return `${h}-kuih-${cyc(2, 3)}`;
    case 'ears': return `${h}-ears-${cyc(2, 6)}`;
    case 'sniff': return `${h}-sniff-${t < 0.7 ? 0 : 1}`;
    case 'lounge': return `${h}-lounge-${cyc(2, 1)}`;
    case 'castle': return `${h}-castle-${cyc(2, 3)}`;
    // Katong, Changi and Orchard Road: a bowl of laksa, a bauble on the tree, a kite on the beach, waving at a plane, a
    // traveller's suitcase; riding a hired bike has its own pair (lib/jade-duodraw.ts)
    case 'laksa': return `${h}-laksa-${cyc(2, 3)}`;
    case 'bauble': return `${h}-bauble-${t < 0.7 ? 0 : 1}`;
    case 'kite': return `${h}-kite-${cyc(2, 1.5)}`;
    case 'plane': return `${h}-plane-${cyc(2, 3)}`;
    case 'suitcase': return `${h}-suitcase-${cyc(2, 2.5)}`;
    // the west side: chwee kueh, the songbirds, the Slingshot, the koi, the telescope, the lantern walk
    case 'chwee': return `${h}-chwee-${cyc(2, 3)}`;
    case 'birdsong': return `${h}-birdsong-${cyc(2, 1.2)}`;
    case 'sling': return `${h}-sling-${t < 0.5 ? 0 : 1}`;
    case 'koi': return `${h}-koi-${cyc(2, 2)}`;
    case 'stars': return `${h}-stars-${t < 1.6 ? 0 : 1}`;
    case 'lantern-walk': return `${h}-lwalk-${cyc(2, 5)}`;
    // Pulau Ubin (the seventeenth pass): hoof prints, a durian tree, the catch, the binoculars, hailing the bumboat, a durian feast
    case 'read': return `${h}-read-${cyc(2, 2)}`; case 'tree-shake': return `${h}-shake-${cyc(2, 6)}`; case 'catch': return `${h}-catch-${t < 0.45 ? 0 : 1}`; case 'spy': return `${h}-spy-${t < 1.4 ? 0 : 1}`; case 'boat-hail': return `${h}-hail-${cyc(2, 3)}`; case 'eat-durian': return `${h}-eat-durian-${cyc(2, 2.5)}`;
    // the empire: mending a raided shop, a handshake hiring the jaga, sending the partner off, the partner's coin bag
    // handed over, counting a big till
    case 'repair': return `${h}-repair-${cyc(2, 5)}`;
    case 'shake': return `${h}-shake`;
    case 'send': return `${h}-send`;
    case 'bag': return `${h}-bag-${t < 0.5 ? 0 : 1}`;
    case 'count': return `${h}-count-${t < 0.7 ? 0 : 1}`;
    default: return `${h}-idle-${face}`;
  }
}

const GLOWS = new Map<string, HTMLCanvasElement>(), GLOWS_MAX = 64;
/** a 64 px radial gradient from `col` at the centre to clear at the rim (cached per colour, and per inner stop; the
 *  cache keeps the 64 last used, so a caller that passes a new colour every frame cannot grow it without end) */
export function glowSprite(col: string, mid?: [number, string]): HTMLCanvasElement {
  const key = mid ? col + '|' + mid[0] + mid[1] : col; let c = GLOWS.get(key);
  if (c) { GLOWS.delete(key); GLOWS.set(key, c); return c; }
  c = document.createElement('canvas'); c.width = c.height = 64; const g = ctx2d(c); if (!g) return c;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, col); if (mid) gr.addColorStop(mid[0], mid[1]); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); GLOWS.set(key, c);
  while (GLOWS.size > GLOWS_MAX) { const [k0, c0] = GLOWS.entries().next().value!; freeCanvas(c0); GLOWS.delete(k0); }
  return c;
}
export const glowCount = () => GLOWS.size;
/** `rgba(r,g,b,a)` split into the opaque colour and its alpha, so a glow that fades (a new alpha every frame) stamps
 *  one cached sprite at globalAlpha instead of painting a new one per alpha (it was a canvas a frame, never freed) */
const RGBA = /^rgba\(\s*([\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+)\s*,\s*([-+\d.eE]+)\s*\)$/;
export function splitAlpha(col: string): [string, number] {
  const m = RGBA.exec(col); if (!m) return [col, 1];
  const a = Number(m[2]); return Number.isFinite(a) ? ['rgba(' + m[1].replace(/\s+/g, '') + ',1)', Math.max(0, Math.min(1, a))] : [col, 1];
}
export type Cam = { x: number; y: number; k: number; w: number; h: number };
/** a ground chunk: its canvas, the scale it was painted at, the frame it was last drawn and whether a picture was missing */
type Chunk = { c: HTMLCanvasElement; s: number; used: number; miss: boolean };
/** the ground chunks' pixel budget (about 96 MB): WebKit caps the memory all canvases may hold, and a Retina screen's
 *  chunks are up to 820 px square */
const CHUNK_PX = 24e6;

export class Scene {
  x: CanvasRenderingContext2D; w = 0; h = 0; dpr = 1;
  cam: Cam = { x: 0, y: 0, k: 1, w: 0, h: 0 };
  chunks = new Map<number, Chunk>(); frame = 0; t = 0;
  /** the last frame's world scale and how long it has held (see the chunks in draw) */
  lastS = 0; zoomStill = 0;
  overBuckets: Map<number, number[]> = new Map();
  mapK = 8;
  /** the minimap's map in strips under 1,024 px wide (an island-wide canvas is too wide to draw from cheaply every frame) */
  mapStrips: { c: HTMLCanvasElement; x0: number }[] = [];
  /** the next map, painted a few columns a frame (pass 13: painting the whole island in one frame took 50 to 85 ms, and
   * it was repainted every few seconds while paintings were still arriving: the worst of the half-second dips); the
   * old map stays on the dial until the new one is complete */
  mapNext: { strips: { c: HTMLCanvasElement; x0: number }[]; col: number; miss: boolean } | null = null;
  dust: { x: number; y: number; t: number; vx: number; vy: number; c: string; s: number }[] = [];
  juice = new Juice(); lookX = 0; lookY = 0; zoomRide = 1;
  /** the camera's focus eases between heroes on a switch and frames both with a second player; the mouse aim */
  focusX = NaN; focusY = NaN; zoomTwo = 1; aim: { x: number; y: number; on: boolean } | null = null;
  minimap = { x: 0, y: 0, r: 0, on: true };
  /** the minimap's dial, painted off screen (see drawMinimap) */
  mm: HTMLCanvasElement | null = null; mmMask: HTMLCanvasElement | null = null; mmAt: [number, number] = [NaN, NaN];
  life = new Life(spr, (x, px, py, r, col) => this.glow(x, px, py, r, col));
  constructor(public cv: HTMLCanvasElement, public c: City) {
    this.x = cv.getContext('2d', { alpha: false })!;
    c.props.forEach((p, i) => { if (p.layer === 'ground') return; const k = Math.floor(p.x / T / CH) + Math.floor(p.y / T / CH) * 1000; const b = this.overBuckets.get(k) ?? []; b.push(i); this.overBuckets.set(k, b); });
  }
  resize(w: number, h: number, dpr: number) {
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
  }
  /** how many world units fit: phones see about 6.5 tiles across their short side so the hero reads; desktops more */
  baseZoom() {
    const short = Math.min(this.w, this.h), long = Math.max(this.w, this.h);
    if (short < 520) return Math.max(0.62, Math.min(1.1, Math.max(short / (6.2 * T), long / (13 * T))));
    return Math.max(0.6, Math.min(1.35, Math.sqrt(this.w * this.h) / (14.5 * T)));
  }

  // ── chunks: ground textures, kerbs, decals, building shadows, buildings and ground props
  private patterns: Record<string, CanvasPattern | null> = {};
  pattern(x: CanvasRenderingContext2D, n: string) {
    if (this.patterns[n] !== undefined) return this.patterns[n];
    const im = images['tex-' + n];
    if (!im) { missed = true; if (!quietMiss) artMissing.add('tex-' + n); return null; } // not loaded yet: don't cache the miss
    this.patterns[n] = x.createPattern(im, 'repeat'); return this.patterns[n];
  }
  chunk(cx: number, cy: number, s: number): HTMLCanvasElement {
    const key = cx + cy * 1000; const old = this.chunks.get(key);
    if (old && Math.abs(old.s - s) < 0.2) { old.used = this.frame; return old.c; }
    const c = old?.c ?? document.createElement('canvas');
    const size = Math.ceil(CH * T * s); c.width = size; c.height = size;
    const x = ctx2d(c);
    missed = false;
    if (x) { x.setTransform(s, 0, 0, s, -cx * CH * T * s, -cy * CH * T * s); this.paintGround(x, cx * CH, cy * CH, CH, CH); } else missed = true;
    this.chunks.set(key, { c, s, used: this.frame, miss: missed });
    // the least recently drawn chunks go once there are more than 44 or they hold more pixels than the budget
    let px = 0; for (const v of this.chunks.values()) px += v.c.width * v.c.height;
    while (this.chunks.size > 44 || (px > CHUNK_PX && this.chunks.size > 12)) {
      let lo = Infinity, lk = -1; for (const [k, v] of this.chunks) if (v.used < lo && k !== key) { lo = v.used; lk = k; }
      const v = this.chunks.get(lk); if (!v) break; px -= v.c.width * v.c.height; this.dropChunk(lk);
    }
    return c;
  }
  dropChunk(k: number) { const v = this.chunks.get(k); if (v) { freeCanvas(v.c); this.chunks.delete(k); } }
  /** forget every ground chunk and the minimap's map (their canvases freed) */
  dropAll() { for (const k of [...this.chunks.keys()]) this.dropChunk(k); this.dropMap(); }
  dropMap() { for (const st of this.mapStrips) freeCanvas(st.c); this.mapStrips = []; if (this.mapNext) for (const st of this.mapNext.strips) freeCanvas(st.c); this.mapNext = null; }
  /** paint tiles (tx0..tx0+n) of the city's ground layer into x (already transformed to world units) */
  paintGround(x: CanvasRenderingContext2D, tx0: number, ty0: number, nw: number, nh: number, simple = false) {
    quietMiss = simple; try { this.paintGround1(x, tx0, ty0, nw, nh, simple); } finally { quietMiss = false; }
  }
  private paintGround1(x: CanvasRenderingContext2D, tx0: number, ty0: number, nw: number, nh: number, simple: boolean) {
    const c = this.c;
    // under a building: the district's own paving (Little India, Kampong Glam and Sentosa have theirs); bridges are
    // concrete outside Chinatown (the Sentosa Gateway too) and planks over the Singapore River
    // (read in the old frame: the tile the layout table moved here; filler, laid in the new frame, has HDB blocks and
    // concrete bridges)
    const oldOf = (i: number) => unmvT(i % W, Math.floor(i / W));
    const bldTex = (i: number) => { const o = oldOf(i); if (!o) return 'hdb'; const [tx, ty] = o; return tx >= UBIN_X0 && ty >= UBIN_Y0 && tx <= UBIN_X1 ? 'kampong' : ty >= CT_H ? (tx >= SOUTH_X0 - 4 && tx <= SOUTH_X1 + 1 ? (tx >= QUAY_X0 ? 'quay' : tx >= TIONG_X0 ? 'tiong' : 'jurong') : 'resort') : tx >= FAR_X0 - 4 ? (tx >= CHANGI_X0 ? 'changi' : ty < FAR_SPLIT ? 'orchard' : 'katong') : tx >= EAST_X0 - 4 ? (ty < EAST_SPLIT ? 'india' : 'glam') : tx >= OW ? (ty < 38 ? 'hdb' : 'granite') : 'plaza'; };
    const texOf = (g: number, i: number) => g === G.ROAD && (c.flags[i] & F_XWAY) ? 'xway' : g === G.BRIDGE ? ((oldOf(i)?.[0] ?? OW) >= OW || (oldOf(i)?.[1] ?? 0) >= 80 ? 'xway' : 'canal') : g === G.STAIRS ? 'temple' : g === G.BLD ? bldTex(i) : GROUND_NAMES[g];
    const byTex = new Map<string, number[]>();
    for (let ty = ty0; ty < ty0 + nh; ty++) for (let tx = tx0; tx < tx0 + nw; tx++) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const n = texOf(c.ground[ty * W + tx], ty * W + tx); const a = byTex.get(n) ?? []; a.push(tx, ty); byTex.set(n, a);
    }
    for (const [n, a] of byTex) {
      const p = this.pattern(x, n);
      if (p) { p.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0])); x.fillStyle = p; } else x.fillStyle = '#2a2440';
      x.beginPath(); for (let i = 0; i < a.length; i += 2) x.rect(a[i] * T - 0.5, a[i + 1] * T - 0.5, T + 1, T + 1); x.fill();
      // night: the painted ground sits a little darker so lamps, signs and people read on top of it
      const dim = n === 'canal' || n === 'sea' || n === 'bay' || n === 'quarry' ? 0.12 : n === 'walk' || n === 'plaza' || n === 'temple' ? 0.34 : 0.24;
      x.fillStyle = `rgba(14,8,32,${dim})`; x.fill();
    }
    // kerbs: a lit edge and a soft shadow where the pavement meets the road; water edges get a stone lip
    x.lineWidth = 3;
    for (let ty = ty0; ty < ty0 + nh; ty++) for (let tx = tx0; tx < tx0 + nw; tx++) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const g = c.ground[ty * W + tx];
      const nb = (dx: number, dy: number) => { const X = tx + dx, Y = ty + dy; return X < 0 || Y < 0 || X >= W || Y >= H ? g : c.ground[Y * W + X]; };
      const water = (v: number) => v === G.CANAL || v === G.SEA || v === G.BAY;
      if (g === G.ROAD) {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const o = nb(dx, dy); if (o === G.ROAD || o === G.BRIDGE || o === G.BLD) continue;
          x.strokeStyle = 'rgba(0,0,0,.35)'; x.beginPath();
          const x0 = tx * T + (dx === 1 ? T : 0), y0 = ty * T + (dy === 1 ? T : 0);
          if (dx) { x.moveTo(x0 - dx * 2, y0); x.lineTo(x0 - dx * 2, y0 + T); } else { x.moveTo(x0, y0 - dy * 2); x.lineTo(x0 + T, y0 - dy * 2); }
          x.stroke(); x.strokeStyle = 'rgba(255,230,190,.28)'; x.beginPath();
          if (dx) { x.moveTo(x0 + dx, y0); x.lineTo(x0 + dx, y0 + T); } else { x.moveTo(x0, y0 + dy); x.lineTo(x0 + T, y0 + dy); }
          x.stroke();
        }
      }
      if (!water(g) && g !== G.BRIDGE && g !== G.BLD) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        if (!water(nb(dx, dy))) continue;
        x.fillStyle = 'rgba(190,180,170,.85)';
        x.fillRect(tx * T + (dx === 1 ? T - 5 : 0), ty * T + (dy === 1 ? T - 5 : 0), dx ? 5 : T, dy ? 5 : T);
      }
    }
    for (const pa of c.paths) {
      const xs = pa.pts.map(q => q[0]), ys = pa.pts.map(q => q[1]);
      if (Math.max(...xs) < tx0 * T - 100 || Math.min(...xs) > (tx0 + nw) * T + 100 || Math.max(...ys) < ty0 * T - 100 || Math.min(...ys) > (ty0 + nh) * T + 100) continue;
      const pt = this.pattern(x, pa.tex); if (!pt) continue;
      pt.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0]));
      x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(pa.pts[0][0], pa.pts[0][1]);
      for (let i = 1; i < pa.pts.length - 1; i++) { const mx = (pa.pts[i][0] + pa.pts[i + 1][0]) / 2, my = (pa.pts[i][1] + pa.pts[i + 1][1]) / 2; x.quadraticCurveTo(pa.pts[i][0], pa.pts[i][1], mx, my); }
      const lp = pa.pts[pa.pts.length - 1]; x.lineTo(lp[0], lp[1]);
      x.strokeStyle = 'rgba(10,6,24,.35)'; x.lineWidth = pa.w + 8; x.stroke();
      x.strokeStyle = pt; x.lineWidth = pa.w; x.stroke();
      x.strokeStyle = 'rgba(14,8,32,.22)'; x.stroke(); x.restore();
    }
    const inR = (px: number, py: number, m: number) => px > tx0 * T - m && px < (tx0 + nw) * T + m && py > ty0 * T - m && py < (ty0 + nh) * T + m;
    for (const d of c.decals) {
      if (!inR(d.x, d.y, 200)) continue;
      if (d.sprite.startsWith('d-bridge')) {
        const fs = frameSize(d.sprite); const hh = d.sprite === 'd-bridge-stone' ? 4.5 * T : 2.7 * T;
        void fs;
        const s2 = src(d.sprite);
        if (s2 && d.rot) { x.save(); x.translate(d.x, d.y); x.rotate(d.rot); x.drawImage(s2[0], s2[1], s2[2], s2[3], s2[4], -(d.w ?? 0) / 2, -hh / 2, d.w ?? 0, hh); x.restore(); }
        else if (s2) x.drawImage(s2[0], s2[1], s2[2], s2[3], s2[4], d.x - (d.w ?? 0) / 2, d.y - hh / 2, d.w ?? 0, hh);
        continue;
      }
      if (!simple) spr(x, d.sprite, d.x, d.y, { w: d.w, anchor: 'center', rot: d.rot, alpha: d.sprite === 'd-dash' || d.sprite === 'd-zebra' ? 0.75 : 0.9 });
    }
    for (const p of c.props) if (p.layer === 'ground' && inR(p.x, p.y, 200)) {
      if (p.sprite.startsWith('containers')) { const s2 = src('containers'); if (s2) { const l = p.w ?? 128; x.save(); x.translate(p.x, p.y); x.rotate(p.rot ?? 0); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(-l / 2 + 6, -T / 2 + 8, l, T); x.drawImage(s2[0], s2[1], s2[2], s2[3], s2[4], -l / 2, -T / 2 - 14, l, T + 14); x.restore(); } continue; }
      if (p.sprite === 'hedge') { spr(x, 'plants', p.x, p.y + 24, { w: 62 }); continue; }
      spr(x, p.sprite, p.x, p.y + (p.solid === 'low' ? 26 : 30), { w: (p.sprite === 'lucky-circle' ? 120 : undefined), anchor: p.sprite === 'lucky-circle' ? 'center' : 'bottom' });
    }
    // buildings with a soft drop shadow
    // buildings, each casting a soft shadow down and to the right (baked once into the chunk)
    const k = x.getTransform().a;
    if (!simple) { x.shadowColor = 'rgba(6,4,18,.6)'; x.shadowBlur = 16 * k; x.shadowOffsetX = 9 * k; x.shadowOffsetY = 13 * k; }
    for (const b of c.buildings) {
      if (b.x + b.w < tx0 - 1 || b.x > tx0 + nw + 1 || b.y + b.h < ty0 - 1 || b.y > ty0 + nh + 1) continue;
      const s2 = src(b.sprite);
      if (s2) x.drawImage(s2[0], s2[1], s2[2], s2[3], s2[4], b.x * T - 2, b.y * T - 4, b.w * T + 4, b.h * T + 6);
      else { x.fillStyle = '#5a3040'; x.fillRect(b.x * T, b.y * T, b.w * T, b.h * T); }
    }
    x.shadowColor = 'rgba(0,0,0,0)'; x.shadowBlur = 0; x.shadowOffsetX = 0; x.shadowOffsetY = 0;
  }

  // ── the whole-city map (minimap and the full map screen use it)
  mapMiss = false; mapT = 0;
  /** paint the next few columns of the map (about MAP_BUDGET ms a frame); swaps it in once complete. True when ready */
  mapWork(): boolean {
    const k = this.mapK;
    if (!this.mapNext && this.mapStrips.length) return true;
    if (!this.mapNext) this.mapNext = { strips: [], col: 0, miss: false };
    const nb = this.mapNext, t0 = now(), SW = Math.floor(MAP_STRIP / k); // tiles a strip
    while (nb.col < W && now() - t0 < MAP_BUDGET) {
      const si = Math.floor(nb.col / SW);
      if (!nb.strips[si]) { const c = document.createElement('canvas'); c.width = Math.min(SW + 1, W - si * SW) * k; c.height = H * k; nb.strips[si] = { c, x0: si * SW * k }; }
      const st = nb.strips[si], x = ctx2d(st.c), n = Math.min(MAP_COLS, (si + 1) * SW - nb.col, W - nb.col);
      // each strip also paints one column past its end, so neighbouring strips meet without a seam
      const n1 = nb.col + n === (si + 1) * SW && nb.col + n < W ? n + 1 : n;
      missed = false;
      if (x) { x.setTransform(k / T, 0, 0, k / T, -st.x0, 0); this.paintGround(x, nb.col, 0, n1, H, true); } else missed = true;
      nb.miss = nb.miss || missed; nb.col += n;
    }
    if (nb.col < W) return this.mapStrips.length > 0;
    for (const st of this.mapStrips) freeCanvas(st.c);
    this.mapStrips = nb.strips; this.mapMiss = nb.miss; this.mapT = this.t; this.mapNext = null;
    return true;
  }

  // ── a frame
  artSeen = 0;
  draw(w: World, dt: number) {
    const x = this.x; this.frame++; this.t += dt; drawClock = now();
    // a painting just arrived: repaint the ground chunks painted without one of theirs (a few a frame, below), and the
    // minimap's map at most every few seconds while pictures are still coming in
    if (this.artSeen !== artGen) {
      this.artSeen = artGen;
      for (const v of this.chunks.values()) if (v.miss) v.s = -9; // repainted in place (drawn as it was until then)
    }
    // (the old map stays up while the new one is painted)
    if (this.mapStrips.length && this.mapMiss && !this.mapNext && this.t - this.mapT > 4 && this.artSeen === artGen) this.mapNext = { strips: [], col: 0, miss: false };
    const p = w.p; const ride = p.ride;
    this.juice.tick(dt);
    if (ride) this.juice.trail(dt, p.boostT > 0, ride.b.x, ride.b.y, ride.b.h, 'v-' + ride.kind);
    // camera: lead in the direction of travel, pull out a little when riding fast
    const sp = ride ? ride.b.speed : p.b.speed, hd = ride ? ride.b.h : p.b.h;
    const phone = Math.min(this.w, this.h) < 520;
    const lead = ride ? Math.min(phone ? 210 : 160, sp * (phone ? 0.6 : 0.45)) : Math.min(50, sp * 0.2);
    this.lookX += (Math.cos(hd) * lead - this.lookX) * Math.min(1, dt * 2.5);
    this.lookY += (Math.sin(hd) * lead - this.lookY) * Math.min(1, dt * 2.5);
    const zr = ride ? (phone ? 0.86 - Math.min(0.14, sp / 2600) : 0.9 - Math.min(0.1, sp / 3400)) : 1;
    this.zoomRide += (zr - this.zoomRide) * Math.min(1, dt * 1.5);
    // two players: frame both heroes (the leash keeps them close enough); one: follow yours, easing across on a switch
    const m = w.mate, tx = w.two ? (p.x + m.x) / 2 : p.x, ty = w.two ? (p.y + m.y) / 2 : p.y;
    if (!isFinite(this.focusX) || Math.hypot(tx - this.focusX, ty - this.focusY) > 2400) { this.focusX = tx; this.focusY = ty; }
    this.focusX += (tx - this.focusX) * Math.min(1, dt * 7); this.focusY += (ty - this.focusY) * Math.min(1, dt * 7);
    const base = this.baseZoom();
    const zt = w.two ? Math.min(1, (this.w / base) / (Math.abs(p.x - m.x) + 520), (this.h / base) / (Math.abs(p.y - m.y) + 380)) : 1;
    this.zoomTwo += (zt - this.zoomTwo) * Math.min(1, dt * 3);
    const k = base * this.zoomRide * this.zoomTwo * this.juice.zoom();
    const [shx, shy] = this.juice.shakeXY();
    const cam = this.cam; cam.k = k; cam.w = this.w / k; cam.h = this.h / k;
    const lk = w.two ? 0.3 : 1;
    cam.x = Math.max(cam.w / 2, Math.min(W * T - cam.w / 2, this.focusX + this.lookX * lk)) + shx;
    cam.y = Math.max(cam.h / 2, Math.min(H * T - cam.h / 2, this.focusY + this.lookY * lk)) + shy;
    const ox = cam.x - cam.w / 2, oy = cam.y - cam.h / 2;
    // the scale is snapped to 1/512 (a chunk is 512 units, so it spans whole pixels) and the camera to whole pixels, so
    // a ground chunk painted at this scale is copied to the screen pixel for pixel: a scaled copy of every chunk was
    // the costliest thing in a frame
    const s = snapScale(this.dpr, k);
    if (Math.abs(s - this.lastS) > 0.0005) { this.lastS = s; this.zoomStill = 0; } else this.zoomStill += dt;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#100c20'; x.fillRect(0, 0, this.cv.width, this.cv.height);
    x.setTransform(s, 0, 0, s, Math.round(-ox * s), Math.round(-oy * s));
    x.imageSmoothingEnabled = true;
    // chunks (at most a couple of new ones a frame; the rest wait a frame). A chunk painted at another scale is drawn
    // scaled until the zoom has been still for a moment, then repainted at this one, one a frame
    const cs = Math.min(1.6, Math.max(0.5, s));
    let made = 0, exact = 0;
    const cx0 = Math.floor(ox / (CH * T)), cy0 = Math.floor(oy / (CH * T)), cx1 = Math.floor((ox + cam.w) / (CH * T)), cy1 = Math.floor((oy + cam.h) / (CH * T));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0 || cx * CH >= W || cy * CH >= H) continue;
      const key = cx + cy * 1000, have = this.chunks.get(key);
      const stale = have ? chunkStale(have.s, cs, this.zoomStill) : 'now';
      if (stale === 'now') { if (made >= 3 && have) { x.drawImage(have.c, cx * CH * T, cy * CH * T, CH * T, CH * T); have.used = this.frame; continue; } made++; }
      else if (stale === 'later' && exact < 1 && made < 2) { exact++; made++; have!.s = -9; }
      const c = this.chunk(cx, cy, cs);
      x.drawImage(c, cx * CH * T, cy * CH * T, CH * T, CH * T);
    }
    this.water(x, ox, oy, cam.w, cam.h);
    this.routeLine(x, w);
    this.markers(x, w, 'ground');
    setGround(this, x, w);
    sgGround(this, x, w, ox, oy, cam.w, cam.h);
    const vis0 = (px: number, py: number, mm = 160) => px > ox - mm && px < ox + cam.w + mm && py > oy - mm && py < oy + cam.h + mm * 1.5;
    gearGround(this, x, w, vis0);
    isleGround(this, x, w, vis0);
    eastGround(this, x, w, vis0);
    southGround(this, x, w, vis0);
    // y-sorted things
    const list: [number, () => void][] = [];
    const vis = (px: number, py: number, m = 160) => px > ox - m && px < ox + cam.w + m && py > oy - m && py < oy + cam.h + m * 1.5;
    for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
      const b = this.overBuckets.get(cx + cy * 1000); if (!b) continue;
      for (const i of b) { const pr = this.c.props[i]; if (pr.layer !== 'over' || !vis(pr.x, pr.y)) continue; list.push([pr.y + (pr.sprite.startsWith('stall') ? 20 : 0), () => this.prop(x, pr)]); }
    }
    for (const r of w.rides) if (r !== ride && r !== m.ride && vis(r.b.x, r.b.y)) list.push([r.b.y, () => this.ride(x, w, r, false)]);
    for (const c of w.cars) if (vis(c.x, c.y)) list.push([c.y, () => { x.fillStyle = 'rgba(0,0,0,.3)'; this.shadow(x, c.x + 5, c.y + 7, c.len * 0.5, c.rad); spr(x, c.sprite, c.x, c.y, { anchor: 'center', rot: c.h + Math.PI / 2 + (c.wob > 0 ? Math.sin(this.t * 40) * 0.06 : 0) }); }]);
    for (const pd of w.peds) if (vis(pd.x, pd.y)) list.push([pd.y, () => this.ped(x, w, pd)]);
    for (const cm of w.cast) if (vis(cm.x, cm.y)) list.push([cm.y, () => this.giver(x, w, cm)]);
    for (const wd of w.wardens) if (vis(wd.b.x, wd.b.y)) list.push([wd.b.y, () => this.warden(x, wd)]);
    for (const b of w.blocks) if (vis(b.x, b.y)) list.push([b.y, () => spr(x, b.sprite, b.x, b.y, { anchor: 'center', rot: b.h, w: 100, alpha: b.knocked > 0 ? Math.max(0, 1 - b.knocked) : 1 })]);
    if (w.run) for (const a of w.run.actors) if (vis(a.b.x, a.b.y) && a.kind !== 'swoop' && !a.gone) list.push([a.b.y, () => this.actor(x, w, a)]);
    this.c.cats.forEach((ct, i) => { if (w.s.cats.includes(i) || !vis(ct.x, ct.y) || !w.open.has(districtAt(Math.floor(ct.x / T), Math.floor(ct.y / T)))) return; list.push([ct.y, () => this.cat(x, ct.x, ct.y, i)]); });
    for (const m of this.c.murals) if (vis(m.x, m.y)) list.push([m.y - 40, () => spr(x, w.s.murals.includes(m.id) ? 'mural-fresh' : 'mural-faded', m.x, m.y + 6, { w: 84 })]);
    for (const l of this.c.ladders) if (vis(l.x * T, l.y * T)) list.push([l.y * T + 10, () => spr(x, 'fire-ladder', l.x * T + T / 2, l.y * T + T - 4, { h: 96 })]);
    this.life.sorted(x, w, list, vis, this.t);
    setSorted(this, x, w, list, vis); empSorted(this, x, w, list, vis);
    sgSorted(this, x, w, list, vis);
    gearSorted(this, x, w, list, vis);
    isleSorted(this, x, w, list, vis);
    eastSorted(this, x, w, list, vis); farSorted(this, x, w, list, vis); southSorted(this, x, w, list, vis); ubinSorted(this, x, w, list, vis);
    if (!p.roof) list.push([p.y + 1, () => this.hero(x, w)]);
    if (!m.roof && !m.seat && vis(m.x, m.y)) list.push([m.y + 0.5, () => drawHero(this, x, w, m, w.two)]);
    list.sort((a, b) => a[0] - b[0]);
    for (const [, f] of list) f();
    if (p.roof || m.roof) { if (p.roof) this.roofDim(x, ox, oy, cam.w, cam.h); this.markers(x, w, 'roof'); if (m.roof && !m.seat) drawHero(this, x, w, m, w.two); if (p.roof) this.hero(x, w); }
    aimLine(this, x, w, this.aim, shooterFor(w, p));
    this.markers(x, w, 'over');
    // flying and overhead things
    // (21-11) a canopy or gantry turns see-through over anyone standing under it (the heroes, a job giver), so Kak
    // Melati under the Clarke Quay umbrellas or Dora on a gantry'd road never vanishes
    const under: [number, number][] = [[p.x, p.y - 30], [m.x, m.y - 30]];
    for (const g of w.cast) if (vis(g.x, g.y, 200)) under.push([g.x, g.y - 30]);
    for (const pr of this.c.props) if (pr.layer === 'sky' && vis(pr.x, pr.y, 200)) {
      if (pr.sprite.startsWith('lanterns')) { this.lanternString(x, pr.x, pr.y, pr.w ?? 4 * T, pr.rot ?? 0, pr.sprite.endsWith('gold')); continue; }
      const fs = frameSize(pr.sprite); const lw = pr.w ?? fs[0];
      spr(x, pr.sprite, pr.x, pr.y, { w: lw, anchor: 'center', rot: pr.rot, alpha: skyAlpha(pr.x, pr.y, lw, under) });
    }
    for (const sn of w.snatchers) { this.flyer(x, sn.x, sn.y, sn.h + ((sn.dizzy ?? 0) > 0 ? this.t * 12 : 0), sn.wing); if ((sn.dizzy ?? 0) > 0) this.stars(x, sn.x, sn.y - 24); }
    gearOver(this, x, w, vis);
    sgOver(this, x, w, vis);
    isleOver(this, x, w, vis);
    eastOver(this, x, w, vis); farOver(this, x, w, vis); southOver(this, x, w, vis); empOver(this, x, w);
    // what F would grab right now gets a pulsing gold ring, so it stands out behind cables and heroes
    if (w.run && !w.talk) { const o = tagOption(w); if (o?.kind === 'snatch') { const g = grabTarget(w), p = w.p;
      const t = g?.kind === 'actor' ? [g.a.b.x, g.a.b.y] : w.run.items.filter(i => !i.got).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      const [gx, gy] = Array.isArray(t) ? t : t ? [t.x, t.y] : [0, 0];
      if (t) { x.save(); x.strokeStyle = 'rgba(255,214,90,.95)'; x.lineWidth = 4; x.setLineDash([10, 8]); x.lineDashOffset = -this.t * 40; x.beginPath(); x.arc(gx, gy - 20, 34 + Math.sin(this.t * 6) * 3, 0, Math.PI * 2); x.stroke(); x.restore(); } } }
    if (w.run) for (const a of w.run.actors) if (a.kind === 'swoop') this.flyer(x, a.b.x, a.b.y, a.b.h + (a.stun > 0 ? this.t * 12 : 0), a.t * 9);
    this.life.over(x, w, vis, dt, cam);
    this.life.rainWorld(x, w, dt, cam);
    this.lights(x, w, ox, oy, cam.w, cam.h);
    if (w.blimp.on) this.blimp(x, w);
    this.fog(x, w, ox, oy, cam.w, cam.h);
    this.particles(x, dt);
    this.juice.drawWorld(x, spr);
    // night tint by the clock and a soft vignette (screen space)
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // every flat screen tint (dusk, dawn, a graveyard shift, the rain's wet sheen and its dimming) folded into one
    // colour and baked with the vignette into one half-size canvas, repainted only when the tint changes: each was a
    // full-screen fill of its own, and the vignette a full-screen gradient, every frame
    const cl = w.s.clock, tints: [number, number, number, number][] = [];
    if (cl < 90) tints.push([120, 60, 140, 0.16 * (1 - cl / 90)]);
    if (cl > 630) tints.push([255, 140, 120, 0.14 * (cl - 630) / 90]);
    if (w.dark) tints.push([14, 18, 60, 0.3]);
    if (w.rain >= 0.02) tints.push([30, 50, 110, 0.14 * w.rain], [20, 30, 70, 0.12 * w.rain]);
    x.drawImage(this.vignette(tints), 0, 0, this.w, this.h);
    sgFlash(x, w, this.cv.width, this.cv.height);
    if (lanterns(w) >= 1) { const a = 0.08 + 0.05 * Math.sin(this.t * 6); x.fillStyle = `rgba(255,40,60,${a * lanterns(w) / 5})`; x.fillRect(0, 0, this.w, 6); x.fillRect(0, this.h - 6, this.w, 6); }
    this.life.rainScreen(x, w, this.w, this.h, this.t);
    this.juice.drawScreen(x, this.w, this.h, ride ? sp : 0, hd, !!ride && p.boostT > 0, w.heat);
    if (this.minimap.on) this.drawMinimap(x, w);
  }
  private vig: HTMLCanvasElement | null = null; private vigKey = '';
  /** the vignette with the screen tints under it: tints are [r, g, b, alpha] fills in the order they were painted */
  vignette(tints: [number, number, number, number][] = []): HTMLCanvasElement {
    const vw = Math.max(1, Math.round(this.w * this.dpr)), vh = Math.max(1, Math.round(this.h * this.dpr));
    // fold the fills: each one maps the screen D to c·a + (1 − a)·D, so together they are P + Q·D, one fill of alpha
    // 1 − Q and colour P / (1 − Q)
    const { col, a: A } = foldTints(tints);
    const key = `${vw}x${vh}|${col}|${A}`;
    if (this.vig && this.vigKey === key) return this.vig;
    if (this.vig && (this.vig.width !== vw || this.vig.height !== vh)) { freeCanvas(this.vig); this.vig = null; }
    const c = this.vig ?? document.createElement('canvas'); c.width = vw; c.height = vh; const g = ctx2d(c);
    if (!g) return c;
    g.clearRect(0, 0, vw, vh);
    if (A > 0) { g.fillStyle = `rgba(${col},${A})`; g.fillRect(0, 0, vw, vh); }
    const gr = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    gr.addColorStop(0, 'rgba(10,6,30,0)'); gr.addColorStop(1, 'rgba(10,6,30,.45)'); g.fillStyle = gr; g.fillRect(0, 0, vw, vh);
    this.vig = c; this.vigKey = key; return c;
  }
  /** a string of paper lanterns across the street: a sagging cable with upright painted lanterns hung along it */
  lanternString(x: CanvasRenderingContext2D, cx: number, cy: number, len: number, rot: number, gold: boolean) {
    const dx = Math.cos(rot) * len / 2, dy = Math.sin(rot) * len / 2;
    const ax = cx - dx, ay = cy - dy, bx = cx + dx, by = cy + dy, sag = 26;
    x.strokeStyle = 'rgba(40,20,20,.85)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(ax, ay); x.quadraticCurveTo(cx + sag * 0.3, cy + sag, bx, by); x.stroke();
    const n = Math.max(3, Math.round(len / 70));
    for (let i = 1; i < n; i++) {
      const t = i / n, u = 1 - t;
      const px = u * u * ax + 2 * u * t * (cx + sag * 0.3) + t * t * bx, py = u * u * ay + 2 * u * t * (cy + sag) + t * t * by;
      const sw = Math.sin(this.t * 1.6 + i + cx * 0.01) * 0.08;
      spr(x, 'ui-lantern-on', px, py + 30, { h: 40, rot: sw, variant: gold ? 'paint:40' : '' });
    }
  }
  shadow(x: CanvasRenderingContext2D, px: number, py: number, rx: number, ry: number) { x.beginPath(); x.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); x.fill(); }

  prop(x: CanvasRenderingContext2D, p: City['props'][number]) {
    if (p.sprite.startsWith('tree') || p.sprite === 'palm') { x.fillStyle = 'rgba(0,0,0,.3)'; this.shadow(x, p.x + 10, p.y + 14, 44, 30); spr(x, p.sprite, p.x, p.y, { anchor: 'center', rot: Math.sin(this.t * 0.8 + p.x) * 0.03 }); return; }
    if (p.sprite.startsWith('stall')) { spr(x, p.sprite, p.x, p.y + 34, { w: p.w }); return; }
    if (p.sprite === 'crane') { spr(x, 'crane', p.x, p.y + 30, {}); return; }
    spr(x, p.sprite, p.x, p.y + 12, {});
  }
  ride(x: CanvasRenderingContext2D, w: World, r: Ride, player: boolean) {
    const name = r.broken ? 'van-broken' : r.kind === 'boat' ? (r.id % 2 ? 'v-bumboat-b' : 'v-bumboat') : 'v-' + r.kind; const paint = AS_PAINTED.has(r.kind) ? 0 : player ? PAINTS.find(q => q.id === w.s.paint)?.filter ?? 0 : [0, 140, 40, 210, 280][r.tint % 5];
    x.fillStyle = 'rgba(0,0,0,.32)'; this.shadow(x, r.b.x + 5, r.b.y + 7, VEHICLES[r.kind].len * 0.45, VEHICLES[r.kind].r * 0.9);
    const bob = onWater(r.kind) ? Math.sin(this.t * 2 + r.id) * 0.03 : 0;
    spr(x, name, r.b.x, r.b.y, { anchor: 'center', rot: r.b.h + Math.PI / 2 + bob, variant: paint ? 'paint:' + paint : '' });
    if (r.locked && !player) { const b = Math.sin(this.t * 4) * 3; spr(x, 'i-key', r.b.x, r.b.y - 30 + b, { w: 26, anchor: 'center' }); }
  }
  hero(x: CanvasRenderingContext2D, w: World) { drawHero(this, x, w, w.p, true); }
  /** a job giver standing at their place: idle, waving when they have a job for you, talking during their lines */
  giver(x: CanvasRenderingContext2D, w: World, cm: CastMember) {
    x.fillStyle = 'rgba(0,0,0,.3)'; this.shadow(x, cm.x, cm.y + 4, 18, 7);
    spr(x, castFrame(cm, castPose(w, cm), this.t), cm.x, cm.y + 8, {});
  }
  ped(x: CanvasRenderingContext2D, w: World, pd: World['peds'][number]) {
    const cx = Math.cos(pd.h), sy = Math.sin(pd.h);
    let f = `folk-${pd.sp}-`, flip = false;
    const sit = this.life.pedOver(x, w, pd, this.t);
    if (sit) { x.fillStyle = 'rgba(0,0,0,.3)'; this.shadow(x, pd.x, pd.y + 2, 14, 5); spr(x, sit, pd.x, pd.y + 6, { flip: cx < 0 }); return; }
    if (pd.hop > 0) f += 'hop';
    else if (Math.abs(cx) > Math.abs(sy)) { f += 'side-' + (Math.floor(pd.walk * 5) % 2); flip = cx < 0; }
    else f += sy > 0 ? 'down' : 'up';
    const hop = pd.hop > 0 ? Math.sin((1 - pd.hop / 0.42) * Math.PI) * 18 : Math.abs(Math.sin(pd.walk * 9)) * (pd.wait > 0 ? 0 : 2);
    x.fillStyle = 'rgba(0,0,0,.3)'; this.shadow(x, pd.x, pd.y + 2, 12, 5);
    spr(x, f, pd.x, pd.y + 4 - hop, { flip });
    if (pd.splat) spr(x, pd.splat, pd.x, pd.y - 30 - hop, { w: 26, anchor: 'center', alpha: Math.min(1, (pd.splatT ?? 0) * 2) });
    this.life.umbrella(x, w, pd, hop);
  }
  warden(x: CanvasRenderingContext2D, wd: World['wardens'][number]) {
    x.fillStyle = 'rgba(0,0,0,.3)'; this.shadow(x, wd.b.x + 4, wd.b.y + 6, 26, 12);
    const rot = wd.b.h + Math.PI / 2 + (wd.stun > 0 ? Math.sin(this.t * 30) * 0.4 : 0);
    const hf = wardenHitFrame(wd);
    if (hf) { spr(x, hf, wd.b.x, wd.b.y + 20, { w: 84 }); this.stars(x, wd.b.x, wd.b.y - 50); return; }
    spr(x, Math.floor(wd.pedal * (2 + wd.b.speed / 60)) % 2 ? 'warden-bike-a' : 'warden-bike-b', wd.b.x, wd.b.y, { anchor: 'center', rot });
    if (wd.stun > 0) this.stars(x, wd.b.x, wd.b.y - 20);
    // the bike's flashing lamp
    const on = Math.floor(this.t * 6 + wd.id) % 2 === 0;
    x.save(); x.globalCompositeOperation = 'lighter';
    const g = x.createRadialGradient(wd.b.x, wd.b.y, 2, wd.b.x, wd.b.y, 46); g.addColorStop(0, on ? 'rgba(255,60,60,.55)' : 'rgba(80,140,255,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(wd.b.x - 46, wd.b.y - 46, 92, 92); x.restore();
  }
  actor(x: CanvasRenderingContext2D, w: World, a: Actor) {
    const b = a.b; const fl = Math.floor(a.t * 6) % 2;
    x.fillStyle = 'rgba(0,0,0,.3)';
    if (jobActor(this, x, w, a) || jagaActor(this, x, a)) return;
    if (isleActor(this, x, a)) return;
    switch (a.kind) {
      case 'cart': this.shadow(x, b.x + 4, b.y + 6, 36, 18); spr(x, `crow-cart-${fl}`, b.x, b.y, { anchor: 'center', rot: b.h + Math.PI / 2 + (a.stun > 0 ? Math.sin(this.t * 30) * 0.3 : 0) }); if (a.stun > 0) this.stars(x, b.x, b.y - 30); break;
      case 'decoy': drawDecoy(this, x, a); break;
      case 'boss': realGlint(this, x, w, a); this.shadow(x, b.x + 4, b.y + 6, 30, 14); spr(x, `boss-${fl}`, b.x, b.y, { anchor: 'center', rot: b.h + Math.PI / 2 + (a.stun > 0 ? Math.sin(this.t * 30) * 0.3 : 0) }); if (a.stun > 0) this.stars(x, b.x, b.y - 30); this.glow(x, b.x, b.y, 70, 'rgba(190,80,255,.35)'); break;
      case 'boat': spr(x, a.skin === 'otter' ? `sleek-boat-${fl}` : `crow-boat-${fl}`, b.x, b.y, { anchor: 'center', rot: b.h + Math.PI / 2 + Math.sin(this.t * 3) * 0.04 }); if (a.stun > 0) this.stars(x, b.x, b.y - 30); this.glow(x, b.x, b.y, 60, 'rgba(255,250,220,.3)'); break;
      case 'rival-scooter': this.shadow(x, b.x + 4, b.y + 6, 30, 14); spr(x, `boss-${fl}`, b.x, b.y, { anchor: 'center', rot: b.h + Math.PI / 2, w: 32, variant: 'paint:120' }); break;
      case 'rival-boat': spr(x, `crow-boat-${fl}`, b.x, b.y, { anchor: 'center', rot: b.h + Math.PI / 2 }); break;
      case 'runner': case 'rival-runner': case 'pip': case 'lookout': case 'raider': {
        this.shadow(x, b.x, b.y + 2, 14, 6);
        const cx = Math.cos(b.h), sy = Math.sin(b.h); let f: string, flip = false;
        if (a.stun > 0) f = 'crow-dizzy';
        else if (a.look > 0) f = `crow-look-${Math.floor(a.look * 2) % 2}`;
        else if (a.kind === 'lookout' && a.mind && b.speed < 5 && a.mind.pose) f = a.mind.pose === 'call' ? 'crow-call' : a.mind.pose === 'grumble' ? 'crow-grumble' : a.mind.pose === 'search' ? 'crow-search' : a.mind.pose === 'peer' ? 'crow-peer' : `crow-look-${Math.floor(a.t * 1.5) % 2}`;
        else if (a.kind === 'lookout' && (a.extra ?? 0) > 0) f = `crow-look-${Math.floor(a.t * 1.5) % 2}`;
        else if (b.speed < 5) f = a.kind === 'pip' && a.t < 1 ? 'crow-taunt' : 'crow-walk-down-0';
        else if (Math.abs(cx) > Math.abs(sy)) { f = `crow-run-${Math.floor(a.t * (a.kind === 'pip' || a.kind === 'lookout' ? 5 : 9)) % 2}`; flip = cx < 0; }
        else f = `crow-walk-${sy > 0 ? 'down' : 'up'}-${fl}`;
        if (a.kind === 'lookout' && !((a.stare ?? 0) > 0) && !((a.extra2 ?? 0) > 0)) mindBeam(this, x, a.mind, b.x, b.y - 20, a.b.h, (w.assist ? 170 : 215) * w.diff.look, w.assist ? 0.45 : 0.55);
        if (a.kind === 'pip' && a.look > 0) mindBeam(this, x, a.mind, b.x, b.y - 20, a.face, w.assist ? 165 : 210, 1.2);
        // a rival gang's runner (the tenth and eleventh passes): the same moves in their own painted frames
        const gs = a.skin === 'mac' || a.skin === 'otter' || a.skin === 'liz' || a.skin === 'myna' || a.skin === 'bat' ? a.skin : null;
        if (gs) f = f.startsWith('crow-look') ? (gs === 'liz' ? 'liz-look' : `${gs}-taunt`) : f.replace(/^crow-/, gs + '-');
        spr(x, f, b.x, b.y + 4, { flip, w: gs === 'liz' ? 56 : gs === 'myna' ? 44 : gs === 'bat' ? 48 : gs === 'otter' ? 46 : undefined });
        if ((a.kind === 'runner' || a.kind === 'raider') && a.stun <= 0) spr(x, a.skin === 'mac' ? 'bun' : 'coins', b.x, b.y - 52, { w: 20 });
        if ((a.kind === 'lookout' || a.kind === 'pip') && a.stun <= 0) mindBubble(this, x, a.mind, b.x, b.y - 84);
        break;
      }
      case 'lion': this.shadow(x, b.x, b.y + 4, 44, 14); spr(x, `lion-${Math.floor(a.t * 3) % 2}`, b.x, b.y + 8, { flip: Math.cos(b.h) < 0 }); break;
    }
  }
  flyer(x: CanvasRenderingContext2D, px: number, py: number, h: number, wing: number, kind: 'crow' | 'myna' | 'bat' = 'crow') {
    x.fillStyle = 'rgba(0,0,0,.22)'; this.shadow(x, px + 30, py + 50, 22, 10);
    spr(x, `${kind}-fly-${Math.floor(wing) % 2 ? 0 : 1}`, px, py, { anchor: 'center', rot: h + Math.PI / 2, w: kind === 'myna' ? 54 : kind === 'bat' ? 58 : undefined });
  }
  cat(x: CanvasRenderingContext2D, px: number, py: number, i: number) {
    const b = Math.sin(this.t * 3 + i) * 3;
    this.glow(x, px, py - 10, 34, 'rgba(255,215,90,.35)');
    spr(x, 'lucky-cat', px, py + 6 + b, { w: 30 });
    if (Math.floor(this.t * 2 + i) % 3 === 0) this.sparkle(x, px + 10, py - 26 + b);
  }
  /** a sight cone; `col` is an "r,g,b" triple (lib/jade-aware.ts CONE: gold on patrol, amber suspicious, orange
   * investigating, red alert, violet searching) */
  beam(x: CanvasRenderingContext2D, px: number, py: number, h: number, r: number, half: number, col = '255,240,150') {
    x.save(); const g = x.createRadialGradient(px, py, 10, px, py, r); g.addColorStop(0, `rgba(${col},.38)`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.beginPath(); x.moveTo(px, py); x.arc(px, py, r, h - half, h + half); x.closePath(); x.fill(); x.restore();
  }
  /** a soft additive glow. Painted once per colour into a small gradient canvas and stamped with drawImage (a radial
   *  gradient filled every call, with a save and restore round it, was a fifth of the frame on the bigger map) */
  glow(x: CanvasRenderingContext2D, px: number, py: number, r: number, col: string) {
    const [c, a] = splitAlpha(col); if (a <= 0) return;
    const prev = x.globalCompositeOperation, a0 = x.globalAlpha; x.globalCompositeOperation = 'lighter'; x.globalAlpha = a0 * a;
    x.drawImage(glowSprite(c), px - r, py - r, r * 2, r * 2);
    x.globalCompositeOperation = prev; x.globalAlpha = a0;
  }
  sparkle(x: CanvasRenderingContext2D, px: number, py: number) { x.save(); x.fillStyle = 'rgba(255,250,210,.9)'; x.translate(px, py); x.rotate(this.t * 2); x.fillRect(-1, -6, 2, 12); x.fillRect(-6, -1, 12, 2); x.restore(); }
  stars(x: CanvasRenderingContext2D, px: number, py: number) { for (let i = 0; i < 3; i++) { const a = this.t * 5 + i * 2.1; this.sparkle(x, px + Math.cos(a) * 16, py + Math.sin(a) * 6); } }
  puff(px: number, py: number, c: string) { if (this.dust.length < 160) this.dust.push({ x: px, y: py, t: 0, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, c, s: 6 + Math.random() * 5 }); }
  burst(px: number, py: number, c: string, n = 10) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 120; this.dust.push({ x: px, y: py, t: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, s: 4 + Math.random() * 4 }); } }
  particles(x: CanvasRenderingContext2D, dt: number) {
    for (const d of this.dust) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.94; d.vy *= 0.94; }
    this.dust = this.dust.filter(d => d.t < 0.7);
    for (const d of this.dust) { x.globalAlpha = Math.max(0, 0.7 - d.t); x.fillStyle = d.c; x.beginPath(); x.arc(d.x, d.y, d.s * (1 + d.t), 0, Math.PI * 2); x.fill(); }
    x.globalAlpha = 1;
  }
  water(x: CanvasRenderingContext2D, ox: number, oy: number, cw: number, ch: number) {
    // a slow shimmer of lantern light on the canal and the harbour
    const tx0 = Math.max(0, Math.floor(ox / T)), tx1 = Math.min(W - 1, Math.floor((ox + cw) / T)), ty0 = Math.max(0, Math.floor(oy / T)), ty1 = Math.min(H - 1, Math.floor((oy + ch) / T));
    // in four brightness steps, one path a colour each (two fills per water tile was hundreds of draws over the sea)
    x.save(); x.globalCompositeOperation = 'lighter';
    for (let q = 0; q < 4; q++) {
      const blue = new Path2D(), warm = new Path2D(); let any = false;
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const g = this.c.ground[ty * W + tx]; if (g !== G.CANAL && g !== G.SEA && g !== G.BAY) continue;
        const v = 0.5 + 0.5 * Math.sin(this.t * 1.7 + tx * 0.9 + ty * 1.3); if (Math.min(3, Math.floor(v * 4)) !== q) continue;
        blue.rect(tx * T + 8 + Math.sin(this.t + ty) * 8, ty * T + 20, 30, 3); warm.rect(tx * T + 30 + Math.cos(this.t * 1.3 + tx) * 8, ty * T + 44, 22, 2); any = true;
      }
      if (!any) continue;
      const al = 0.1 * (q + 0.5) / 4; // the old shimmer's 0.05 + 0.05 sin, in four steps
      x.fillStyle = `rgba(120,200,255,${al.toFixed(3)})`; x.fill(blue); x.fillStyle = `rgba(255,160,120,${(al * 0.8).toFixed(3)})`; x.fill(warm);
    }
    x.restore();
  }
  roofDim(x: CanvasRenderingContext2D, ox: number, oy: number, cw: number, ch: number) {
    // up on the roofs: the street below falls into shadow, the terraces stay lit
    x.fillStyle = 'rgba(8,5,22,.45)'; x.fillRect(ox, oy, cw, ch);
    for (const b of this.c.buildings) if (b.roof) { const s2 = src(b.sprite); if (s2) x.drawImage(s2[0], s2[1], s2[2], s2[3], s2[4], b.x * T - 2, b.y * T - 4, b.w * T + 4, b.h * T + 6); }
    void F_ROOF;
  }
  routeLine(x: CanvasRenderingContext2D, w: World) {
    if (!(w.assist || (!w.run && w.waypoint)) || w.route.length < 2) return;
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(w.p.x, w.p.y); for (let i = 1; i < w.route.length; i++) x.lineTo(w.route[i][0], w.route[i][1]);
    x.strokeStyle = 'rgba(255,214,90,.25)'; x.lineWidth = 18; x.stroke();
    x.setLineDash([14, 18]); x.lineDashOffset = -this.t * 40; x.strokeStyle = 'rgba(255,230,140,.85)'; x.lineWidth = 6; x.stroke();
    x.restore();
  }
  /** colour-blind-safe marks (Settings): each kind of marker also gets its own shape, outlined black and white so it
   * reads on any colour: the goal a diamond, loot a star, things to collect a ring, a job a square, a ticket warden a
   * triangle, a gang member a cross */
  cb(x: CanvasRenderingContext2D, kind: 'goal' | 'loot' | 'item' | 'job' | 'warn' | 'gang', px: number, py: number, r = 12) {
    x.save(); x.translate(px, py); x.beginPath();
    if (kind === 'goal') { x.moveTo(0, -r); x.lineTo(r, 0); x.lineTo(0, r); x.lineTo(-r, 0); x.closePath(); }
    else if (kind === 'loot') for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    else if (kind === 'item') { x.arc(0, 0, r, 0, Math.PI * 2); x.moveTo(r * 0.45, 0); x.arc(0, 0, r * 0.45, 0, Math.PI * 2); }
    else if (kind === 'job') x.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
    else if (kind === 'warn') { x.moveTo(0, -r); x.lineTo(r, r * 0.8); x.lineTo(-r, r * 0.8); x.closePath(); }
    else { x.moveTo(-r, -r); x.lineTo(r, r); x.moveTo(r, -r); x.lineTo(-r, r); }
    if (kind === 'loot' || kind === 'goal' || kind === 'job' || kind === 'warn') { x.closePath(); x.fillStyle = 'rgba(255,255,255,.9)'; x.fill('evenodd'); }
    x.lineWidth = 5; x.strokeStyle = '#000'; x.stroke(); x.lineWidth = 2.2; x.strokeStyle = '#fff'; x.stroke();
    if (kind === 'goal' || kind === 'job') { x.beginPath(); x.moveTo(-r * 0.4, -r * 0.4); x.lineTo(r * 0.4, r * 0.4); x.moveTo(r * 0.4, -r * 0.4); x.lineTo(-r * 0.4, r * 0.4); x.lineWidth = 2; x.strokeStyle = '#000'; x.stroke(); }
    if (kind === 'warn') { x.fillStyle = '#000'; x.fillRect(-1.5, -r * 0.35, 3, r * 0.6); x.fillRect(-1.5, r * 0.4, 3, 3); }
    x.restore();
  }
  markers(x: CanvasRenderingContext2D, w: World, layer: 'ground' | 'over' | 'roof') {
    const run = w.run; const b = Math.sin(this.t * 4) * 5; const cb = w.s.settings.cbMarks;
    if (layer === 'ground') {
      // pins: contacts with a job for you, markets, safe houses, garages, gigs
      if (!run) {
        for (const n of nearList(w)) {
          if (n.kind === 'mission') { this.glow(x, n.x, n.y, 70, 'rgba(255,210,80,.35)'); }
        }
      }
      if (run) {
        if (!jobGround(this, x, w, run)) for (const it of run.items) if (!it.got) { this.glow(x, it.x, it.y, 46, 'rgba(255,200,80,.4)'); spr(x, itemSprite(it.sprite), it.x, it.y + 10, { w: it.sprite === 'lookout' ? 60 : 30 }); if (cb) this.cb(x, 'item', it.x + 26, it.y - 30); }
        if (run.loot) { this.glow(x, run.loot.x, run.loot.y, 54, 'rgba(120,255,200,.45)'); spr(x, run.loot.sprite, run.loot.x, run.loot.y + 8 + b * 0.4, { w: 40 }); if (cb) this.cb(x, 'loot', run.loot.x + 30, run.loot.y - 34, 14); }
        if (run.cur.t === 'pickup' && run.cur.at !== 'loot') { const [px, py] = run.spot(run.cur.at); spr(x, itemSprite(run.cur.item), px, py + 10, { w: 34 }); }
        if (run.fare) { const f = run.fare; if (!f.to) spr(x, `folk-${f.sp}-hop`, f.x, f.y + 4, {}); }
      }
      return;
    }
    if (layer === 'roof' || layer === 'over') {
      if (run) {
        const marks = run.marks; const st = run.cur;
        if (st && st.t === 'race' && !!st.roof === (layer === 'roof')) for (let i = run.mark; i < Math.min(marks.length, run.mark + 2); i++) spr(x, 'gate', marks[i][0], marks[i][1] + 16, { w: i === run.mark ? 76 : 50, alpha: i === run.mark ? 1 : 0.5 });
        const o = w.objective();
        if (o && layer === 'over' && !(st && st.t === 'race')) { this.glow(x, o[0], o[1], 50, 'rgba(255,220,90,.4)'); spr(x, 'ui-arrow', o[0], o[1] - 50 + b, { w: 34, rot: Math.PI, anchor: 'center' }); if (cb) this.cb(x, 'goal', o[0], o[1] - 88 + b, 14); }
      }
      if (layer === 'over' && !run) for (const n of nearList(w)) {
        if (n.kind !== 'mission') continue;
        // the giver stands there in person: a job marker bobs over their head; otherwise their face in a ring
        const g = w.cast.find(c => c.job === n.id);
        if (g) { const top = g.y + 8 - (frameSize(`npc-${g.id}-idle-0`)[1] || 60); spr(x, 'pin-job', g.x, top - 20 + b, { w: 34, anchor: 'center' }); if (cb) this.cb(x, 'job', g.x + 26, top - 34 + b, 11); continue; }
        const m = MISSION_FACE(n.id!);
        spr(x, 'ui-ring', n.x, n.y - 40 + b, { w: 64, anchor: 'center' });
        spr(x, m, n.x, n.y - 40 + b, { w: 46, anchor: 'center' });
        spr(x, 'ui-pin', n.x, n.y - 2 + b * 0.3, { w: 22 });
        if (cb) this.cb(x, 'job', n.x + 36, n.y - 64 + b, 11);
      }
      if (layer === 'over') for (const [pid, pl] of Object.entries(this.c.places)) {
        if (!w.open.has(pl.d)) continue;
        const icon = pl.kind === 'market' ? 'ui-coin' : pl.kind === 'safe' ? 'i-safe' : pl.kind === 'garage' ? 'i-garage' : pl.kind === 'contact' ? '' : '';
        if (icon) spr(x, icon, pl.x, pl.y - 34 + Math.sin(this.t * 2 + pl.x) * 3, { w: 30, anchor: 'center', alpha: 0.95 });
        if (pl.kind === 'contact' && !w.cast.some(c => c.home && c.id === pid)) { spr(x, 'ui-ring', pl.x, pl.y - 26, { w: 46, anchor: 'center', alpha: 0.9 }); spr(x, 'face-' + contactFace(pl.name ?? ''), pl.x, pl.y - 26, { w: 32, anchor: 'center' }); }
      }
      // a contract's giver: the job pin with a coin beside it (lib/jade-contracts.ts)
      if (layer === 'over' && !run) for (const g of w.cast) if (g.job?.startsWith('con:')) { const top = g.y + 8 - (frameSize(`npc-${g.id}-idle-0`)[1] || 60); spr(x, 'pin-job', g.x, top - 20 + b, { w: 30, anchor: 'center' }); spr(x, 'ui-coin', g.x + 18, top - 30 + b, { w: 18, anchor: 'center' }); if (cb) this.cb(x, 'job', g.x + 26, top - 34 + b, 11); }
      if (layer === 'over' && !run) for (const g of w.gigs()) spr(x, 'flag', g.x, g.y + 6 + b * 0.2, { w: 26 });
    }
  }
  lights(x: CanvasRenderingContext2D, w: World, ox: number, oy: number, cw: number, ch: number) {
    x.save(); x.globalCompositeOperation = 'lighter';
    const tx0 = Math.floor(ox / (CH * T)) - 1, tx1 = Math.floor((ox + cw) / (CH * T)) + 1, ty0 = Math.floor(oy / (CH * T)) - 1, ty1 = Math.floor((oy + ch) / (CH * T)) + 1;
    for (let cy = ty0; cy <= ty1; cy++) for (let cx = tx0; cx <= tx1; cx++) {
      const bk = this.overBuckets.get(cx + cy * 1000); if (!bk) continue;
      for (const i of bk) {
        const p = this.c.props[i];
        if (p.sprite === 'lamp') this.life.reflect(x, w, p.x, p.y - 10, 'rgba(255,190,110,1)');
        else if (p.sprite.startsWith('stall')) this.life.reflect(x, w, p.x, p.y + 20, 'rgba(255,150,90,1)');
        if (p.sprite === 'lamp') x.drawImage(glowSprite('rgba(255,190,110,.32)'), p.x - 120, p.y - 150, 240, 240);
        else if (p.sprite.startsWith('lanterns')) { const g = glowSprite(p.sprite.endsWith('gold') ? 'rgba(255,210,90,.22)' : 'rgba(255,80,60,.22)'); for (const k of [-1, 0, 1]) x.drawImage(g, p.x - 70, p.y + k * 80 - 70, 140, 140); }
        else if (p.sprite.startsWith('stall')) x.drawImage(glowSprite('rgba(255,170,90,.2)'), p.x - 110, p.y - 100, 220, 220);
      }
    }
    // the hero's ride has a headlight
    const r = w.p.ride;
    if (r && !onWater(r.kind)) { const hx = r.b.x + Math.cos(r.b.h) * 40, hy = r.b.y + Math.sin(r.b.h) * 40; const g = x.createRadialGradient(hx, hy, 0, hx + Math.cos(r.b.h) * 60, hy + Math.sin(r.b.h) * 60, 120); g.addColorStop(0, 'rgba(255,240,200,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(hx, hy); x.arc(hx, hy, 170, r.b.h - 0.4, r.b.h + 0.4); x.fill(); }
    x.restore();
  }
  blimp(x: CanvasRenderingContext2D, w: World) {
    const b = w.blimp;
    const g = x.createRadialGradient(b.x, b.y, 0, b.x, b.y, 120); g.addColorStop(0, 'rgba(255,255,220,.45)'); g.addColorStop(0.7, 'rgba(255,255,200,.18)'); g.addColorStop(1, 'rgba(255,255,200,0)');
    x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.beginPath(); x.arc(b.x, b.y, 120, 0, Math.PI * 2); x.fill(); x.restore();
    x.fillStyle = 'rgba(0,0,0,.2)'; this.shadow(x, b.x + 80, b.y + 120, 70, 26);
    spr(x, 'blimp', b.x - 40, b.y - 150 + Math.sin(this.t) * 6, { anchor: 'center' });
  }
  fog(x: CanvasRenderingContext2D, w: World, ox: number, oy: number, cw: number, ch: number) {
    const rects: [District, number, number, number, number][] = [['temple', 0, 0, 46, 30], ['canal', 46, 0, 29, 62], ['arcade', 75, 0, 45, 62], ['docks', 46, 62, 74, 30]];
    for (const [d, rx, ry, rw, rh] of rects) {
      if (w.open.has(d)) continue;
      const X = rx * T, Y = ry * T, Wd = rw * T, Hd = rh * T;
      if (X > ox + cw || Y > oy + ch || X + Wd < ox || Y + Hd < oy) continue;
      x.fillStyle = 'rgba(40,32,70,.78)'; x.fillRect(X, Y, Wd, Hd);
      x.save(); x.beginPath(); x.rect(X - 40, Y - 40, Wd + 80, Hd + 80); x.clip();
      for (let i = 0; i < 14; i++) {
        const fx = X + ((i * 397 + this.t * 18) % (Wd + 400)) - 200, fy = Y + ((i * 211) % Hd);
        const g = x.createRadialGradient(fx, fy, 0, fx, fy, 260); g.addColorStop(0, 'rgba(190,180,230,.35)'); g.addColorStop(1, 'rgba(190,180,230,0)');
        x.fillStyle = g; x.fillRect(fx - 260, fy - 260, 520, 520);
      }
      x.restore();
    }
  }

  // ── the minimap: the painted city map, clipped to a circle, with pins
  drawMinimap(x: CanvasRenderingContext2D, w: World) {
    const m = this.minimap; if (!m.r) return;
    const k = this.mapK / T;
    if (!this.mapWork()) return;
    const zoom = 0.9; // map px per minimap px
    const px = w.p.x * k, py = w.p.y * k;
    const sc = 1.6 / zoom;
    const toM = (wx: number, wy: number): [number, number] => [m.x + (wx * k - px) * sc, m.y + (wy * k - py) * sc];
    // the dial's map, fog and route line are painted into a small canvas of their own and cut round with a painted
    // mask (a clip path on the screen canvas, every frame, cost a few frames a second); it is repainted every other
    // frame, or at once when the view has slid more than a couple of pixels
    const dpr = this.dpr, D = Math.max(2, Math.ceil(m.r * 2 * dpr));
    if (!this.mm || this.mm.width !== D) {
      this.mm = document.createElement('canvas'); this.mm.width = this.mm.height = D; this.mmAt = [NaN, NaN];
      this.mmMask = document.createElement('canvas'); this.mmMask.width = this.mmMask.height = D;
      const mg = ctx2d(this.mmMask); if (!mg) return; mg.fillStyle = '#fff'; mg.beginPath(); mg.arc(D / 2, D / 2, D / 2, 0, Math.PI * 2); mg.fill();
    }
    const moved = Math.hypot(px * sc - this.mmAt[0], py * sc - this.mmAt[1]);
    if (!(moved < 2.5) || this.frame % 2 === 0) {
      this.mmAt = [px * sc, py * sc];
      const g = ctx2d(this.mm); if (!g) return;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#0d1530'; g.fillRect(0, 0, D, D);
      g.setTransform(dpr, 0, 0, dpr, -(m.x - m.r) * dpr, -(m.y - m.r) * dpr);
      const sx = px - m.r / sc, sy = py - m.r / sc, sw = m.r * 2 / sc, sh = m.r * 2 / sc;
      for (const st of this.mapStrips) { const a0 = Math.max(sx, st.x0), a1 = Math.min(sx + sw, st.x0 + st.c.width); if (a1 <= a0) continue;
        g.drawImage(st.c, a0 - st.x0, sy, a1 - a0, sh, m.x - m.r + (a0 - sx) * sc, m.y - m.r, (a1 - a0) * sc, m.r * 2); }
      // fog
      for (const [d, rx, ry, rw, rh] of [['temple', 0, 0, 46, 30], ['canal', 46, 0, 29, 62], ['arcade', 75, 0, 45, 62], ['docks', 46, 62, 74, 30]] as [District, number, number, number, number][]) {
        if (w.open.has(d)) continue; const [a, b] = toM(rx * T, ry * T); g.fillStyle = 'rgba(40,30,70,.82)'; g.fillRect(a, b, rw * T * k * sc, rh * T * k * sc);
      }
      if (w.route.length > 1 && (w.assist || (!w.run && w.waypoint))) { g.strokeStyle = 'rgba(255,220,100,.95)'; g.lineWidth = 3; g.beginPath(); const [a0, b0] = toM(w.p.x, w.p.y); g.moveTo(a0, b0); // only the part of the route inside the dial (a long route across the island is thousands of units of line)
        for (let i = 1; i < w.route.length; i++) { const [a, b] = toM(w.route[i][0], w.route[i][1]); g.lineTo(a, b); if (Math.hypot(a - m.x, b - m.y) > m.r * 1.6) break; } g.stroke(); }
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(this.mmMask!, 0, 0); g.globalCompositeOperation = 'source-over';
    }
    x.save(); x.drawImage(this.mm, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    const dot = (wx: number, wy: number, col: string, r = 4) => { let [a, b] = toM(wx, wy); const d = Math.hypot(a - m.x, b - m.y); if (d > m.r - 6) { a = m.x + (a - m.x) / d * (m.r - 6); b = m.y + (b - m.y) / d * (m.r - 6); } x.fillStyle = col; x.beginPath(); x.arc(a, b, r, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 1.5; x.stroke(); };
    for (const [, pl] of Object.entries(this.c.places)) if (w.open.has(pl.d)) { if (pl.kind === 'market') dot(pl.x, pl.y, '#ffd25a', 3); else if (pl.kind === 'safe') dot(pl.x, pl.y, '#3ed6a4', 3); }
    if (!w.run) for (const n of nearList(w)) if (n.kind === 'mission') dot(n.x, n.y, '#ffb020', 5);
    // the MRT's stations: their painted pin (pinned to the rim when off the edge)
    for (const st of w.c.isle?.stations ?? []) if (w.open.has(st.d)) { let [a, b] = toM(st.x, st.y); const d = Math.hypot(a - m.x, b - m.y); if (d > m.r - 10) { a = m.x + (a - m.x) / d * (m.r - 10); b = m.y + (b - m.y) / d * (m.r - 10); } spr(x, 'pin-train', a, b + 7, { w: 16 }); }
    // the cable car stations and ferry piers, once both ends are open
    for (const l of [...(w.c.east ? [w.c.east.cable, w.c.east.ferry] : []), ...(w.c.ubin ? [w.c.ubin.boat] : [])]) if (l.stops.every(st => w.open.has(districtAt(Math.floor(st.x / T), Math.floor(st.y / T))))) for (const st of l.stops) { let [a, b] = toM(st.x, st.y); const d = Math.hypot(a - m.x, b - m.y); if (d > m.r - 10) { a = m.x + (a - m.x) / d * (m.r - 10); b = m.y + (b - m.y) / d * (m.r - 10); } spr(x, l.id === 'cable' ? 'pin-cable' : 'pin-ferry', a, b + 7, { w: 16 }); }
    // the empire: your properties as small jade dots, and a raid's painted pin, pulsing, held to the rim when off the edge
    for (const b of BIZ) if (w.open.has(b.d) && w.s.biz[b.id]?.lvl) { const [bx, by] = bizPos(b); dot(bx, by, w.s.biz[b.id].dmg ? '#ff6a4a' : '#7fe0b0', 2.5); }
    if (w.emp.raid) { const [bx, by] = bizPos(BIZ_OF[w.emp.raid.id]); let [a, b] = toM(bx, by); const d = Math.hypot(a - m.x, b - m.y); if (d > m.r - 12) { a = m.x + (a - m.x) / d * (m.r - 12); b = m.y + (b - m.y) / d * (m.r - 12); } spr(x, 'pin-raid', a, b, { w: 22 + 4 * Math.sin(this.t * 8), anchor: 'center' }); }
    for (const wd of w.wardens) dot(wd.b.x, wd.b.y, Math.floor(this.t * 4) % 2 ? '#ff4a4a' : '#5a8cff', 3);
    const o = w.objective(); if (o) dot(o[0], o[1], '#fff27a', 5);
    x.restore();
    // the player arrow
    x.save(); x.translate(m.x, m.y); x.rotate((w.p.ride ? w.p.ride.b.h : w.p.b.h) + Math.PI / 2);
    x.fillStyle = '#fff'; x.strokeStyle = '#c0392b'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -8); x.lineTo(6, 6); x.lineTo(0, 3); x.lineTo(-6, 6); x.closePath(); x.fill(); x.stroke(); x.restore();
    spr(x, 'ui-ring-hollow', m.x, m.y, { w: m.r * 2.46, anchor: 'center' });
  }
  /** effects for world events */
  consume(w: World, fx: ReturnType<World['drain']>) {
    this.juice.consume(fx, w.p.x, w.p.y);
    for (const f of fx) {
      if (f.t === 'bump' && f.x !== undefined) this.burst(f.x, f.y!, '#e8e0f0', 8);
      else if (f.t === 'hit' && f.x !== undefined) this.burst(f.x, f.y!, '#ffd060', 16);
      else if (f.t === 'spill' && f.x !== undefined) this.burst(f.x, f.y!, '#ff9a2a', 18);
      else if ((f.t === 'cat' || f.t === 'pickup' || f.t === 'gate' || f.t === 'mural') && f.x !== undefined) this.burst(f.x, f.y!, '#ffe68a', 14);
      else if (f.t === 'hop' && f.x !== undefined) this.puff(f.x, f.y! + 4, '#cfc8e0');
      else if (f.t === 'sky-lantern' && f.x !== undefined) this.life.lantern(f.x, f.y!);
      else if (f.t === 'good-deed') this.burst(w.p.x, w.p.y - 30, '#ffe68a', 18);
      else if (f.t === 'push' && f.x !== undefined) this.puff(f.x, f.y! + 10, '#cfc8e0');
      else if (f.t === 'smoke' && f.x !== undefined) this.burst(f.x, f.y!, '#a8a0b8', 12);
      else if (f.t === 'dance') for (let i = 0; i < 3; i++) this.life.firework(w.p.x + (i - 1) * 160, w.p.y - 260 - i * 30);
    }
    void w;
  }
}

export function itemSprite(item: string) {
  return ({ crate: 'crates', cake: 'cake', pots: 'pots', parcel: 'rice', coins: 'coins', manifest: 'i-map', lookout: 'crates', token: 'claw', durian: 'durian-crate', recipe: 'ticket', bag: 'handbag', prawns: 'fish-basket', lantern: 'kid-lantern', abacus: 'statuette', decoy: 'job-decoy' } as Record<string, string>)[item] ?? item;
}
function contactFace(name: string) {
  return ({ 'Uncle Kee': 'kee', 'Chef Mo': 'mo', 'Auntie Pang': 'pang', 'Brother Heron': 'heron', 'Master Ren': 'ren', Kiri: 'kiri', 'Mr Lim': 'lim', 'Big Bo': 'bo', Gizmo: 'gizmo' } as Record<string, string>)[name] ?? 'kee';
}
import { offered } from './jade-save.js';
import { MISSION, PEOPLE } from './jade-story.js';
function nearList(w: World) {
  return offered(w.s).map(m => { const pl = w.c.places[m.at]; return { kind: 'mission', x: pl?.x ?? 0, y: pl?.y ?? 0, id: m.id }; });
}
setItemSprite(itemSprite);
function MISSION_FACE(id: string) { const m = MISSION[id]; return PEOPLE[m.giver]?.face ?? 'face-kee'; }

/** how solid an overhead prop draws: 0.95 normally, down to 0.3 when someone stands under its middle (exported for tests) */
export function skyAlpha(cx: number, cy: number, w: number, under: [number, number][]): number {
  const r = w / 2; let near = Infinity;
  for (const [ux, uy] of under) near = Math.min(near, Math.hypot(ux - cx, uy - cy));
  if (near >= r) return 0.95;
  const k = Math.max(0, (near - r * 0.55) / (r * 0.45));
  return 0.3 + 0.65 * k;
}
