// The Sunken Bellspire: drawing only. The world is drawn at about 270 lines (as wide as the screen) into a small canvas, lit by a half-resolution
// lightmap (multiplied in, with an additive glow for anything brighter than white), and the page scales the result up
// by a whole number with no smoothing.
import {
  BellspireGame, INFO, ROOMS, AREAS, TILE, COLS, ROWS, VIEW_W, VIEW_H, FOES, ABILITIES, ABILITY_ORDER, HERO_H, DOOR_CHARS,
  rawChar, groupAt, roomRect, hexRgb, surfaceY, surfaceRow, SWING, foeFrame,
  type Room, type GameEvent, type HeroId, type Boss, type NumKind,
} from './bellspire-game';
import { GUARDIANS, GUARDIAN_AREA } from './bellspire-world';
import { dressStrip, WEAPON_LOOK, COAT_LOOK, START_LOOK, OUTFIT, stripFor } from './bellspire-gear-art';
import { ART, FLAMES, BOXES } from './bellspire-art';
import { HeroAnimator, type AnimInput, type AnimOut } from './bellspire-anim';

type Img = HTMLImageElement | HTMLCanvasElement;
/** Extra treatment for a sprite: `rim` adds a dark outline and a lit upper edge in that colour; `tell` flashes it. */
type SprFx = { rim?: string; tell?: boolean; /** washed over with one colour (the puma's painted twin) */ wash?: string };
/** Each guardian's rim light, in the colour of its arena's light. */
const RIM: Record<string, string> = { frog: '#bfe6ff', hydra: '#eaf5a8', puma: '#ffd49a', warden: '#ffe49a', mother: '#b4fff0', condor: '#ffd0a8', clappers: '#c8d8ff', tune: '#a8f4ff' };
/** A point light; `soft` lights fall off linearly (a wide, even pool), the rest fall off with the square (a hot centre). */
type Light = { x: number; y: number; r: number; c: [number, number, number]; i: number; soft?: boolean };
/** how a piece of decor moves: swings from its top, ripples from its top (cloth, nets), or bends from its base (reeds) */
type Sway = 'pend' | 'cloth' | 'plant' | 'still';
/** which decor frames move, per area (see the decor sheets) */
const SWAY: Record<string, Record<number, Sway>> = {
  halls: { 2: 'pend', 5: 'cloth', 7: 'plant' },
  docks: { 1: 'plant', 5: 'cloth', 6: 'plant' },
  towers: { 0: 'pend', 1: 'pend', 3: 'pend', 7: 'cloth' },
  crypt: {},
  throne: { 2: 'pend', 3: 'plant', 6: 'pend', 7: 'plant' },
  // the Cloudstair: the banner, the prayer cloths, the ichu grass and the chimes move in the wind; the loft's lantern,
  // chain and rope coil hang and swing
  cloud: { 1: 'cloth', 2: 'cloth', 4: 'plant', 6: 'pend' },
  loft: { 0: 'pend', 3: 'pend', 7: 'pend' },
};
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; g: number; light?: boolean };

const TILESET = (room: Room) => AREAS[room.area].tiles;
/** Which decor sprite each map mark uses, per tile set, and the pieces sprinkled on floors, walls and ceilings. */
const DECOR: Record<string, { torch: number; candle: number; window: number; bell: number; floor: number[]; wall: number[]; ceil: number[]; back: number }> = {
  halls: { torch: 6, candle: 0, window: 1, bell: 2, floor: [4, 7], wall: [3, 5], ceil: [], back: 0.55 },
  docks: { torch: 0, candle: 6, window: -1, bell: -1, floor: [1, 3, 4, 7], wall: [5], ceil: [], back: 0 },
  towers: { torch: 4, candle: 6, window: 5, bell: 1, floor: [], wall: [2, 7], ceil: [3], back: 0.45 },
  crypt: { torch: 6, candle: 2, window: -1, bell: -1, floor: [3, 7], wall: [0, 1, 5], ceil: [4], back: 0.92 },
  throne: { torch: 2, candle: 7, window: -1, bell: 6, floor: [1, 3, 4], wall: [5], ceil: [], back: 0.6 },
  // (the Cloudstair is out under the sky: no back wall, and no pillars standing in the air)
  cloud: { torch: 0, candle: 6, window: -1, bell: 0, floor: [3, 4, 5, 7], wall: [1, 2], ceil: [], back: 0 },
  loft: { torch: 0, candle: 2, window: 6, bell: 2, floor: [5], wall: [1, 3, 4], ceil: [7], back: 0.6 },
};
const WATER_TINT: Record<string, [number, number, number]> = { halls: [52, 104, 176], docks: [46, 120, 104], throne: [34, 128, 140], hub: [52, 104, 176], towers: [52, 104, 176], crypt: [60, 70, 120] };
/** The Cloudstair's 'torches' are bell posts that stand on the ground: the floor under a torch mark (world y), or null
 *  where there is none close below. */
function postFloor(room: Room, c: number, r: number): number | null {
  if (AREAS[room.area].tiles !== 'cloud') return null;
  for (let k = 1; k < 14; k++) if ('#='.includes(rawChar(c, r + k))) return (r + k) * TILE;
  return null;
}
/** How far up (in tiles) to the stone over a spot, for chains to hang from; 0 when there is none close above. */
function ceilingAbove(c: number, r: number, max = 12): number {
  for (let k = 0; k < max; k++) if (SOLIDISH.includes(rawChar(c, r - 1 - k))) return k;
  return 0;
}
const hash = (c: number, r: number) => { let h = (c * 374761393 + r * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const SOLIDISH = '#^';

// a 3×5 pixel font for the few words drawn in the world
const GLYPHS: Record<string, string> = {
  'X': '101101010101101', '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', '+': '000010111010000', '!': '010010010000010',
  'L': '100100100100111', 'V': '101101101101010', 'U': '101101101101111', 'P': '111101111100100', ' ': '000000000000000', 'M': '101111111101101',
};

/** The camera's left (or top) edge: inside the room, or centred when the room is smaller than the view. */
function camClamp(t: number, lo: number, span: number, view: number) {
  return span <= view ? lo + (span - view) / 2 : Math.max(lo, Math.min(lo + span - view, t));
}

export class BellspireScene {
  view: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img = new Map<string, Img>();
  white = new Map<string, HTMLCanvasElement>();
  /** the gear each hero is drawn in (for the tests), and each dressed strip's coat bounds per frame (the shell) */
  worn: Record<HeroId, { weapon: string; coat: string }> = { dora: { ...START_LOOK.dora }, enzo: { ...START_LOOK.enzo } };
  coatBoxes = new Map<string, ({ x0: number; x1: number; y0: number; y1: number } | null)[]>();
  /** a sparkle round a hero who just changed gear (ticks left) */
  shineT: Record<HeroId, number> = { dora: 0, enzo: 0 };
  bellSwingT: Record<HeroId, number> = { dora: 0, enzo: 0 };
  /** the camera offset the heroes were last drawn with (to turn screen points back into world points) */
  ox = 0; oy = 0;
  tints = new Map<string, HTMLCanvasElement>();
  rimCanvas = document.createElement('canvas');
  ready = false;
  cam = { x: 0, y: 0 };
  roomId = '';
  roomCanvas: HTMLCanvasElement | null = null;
  edgeCanvas: HTMLCanvasElement | null = null;
  light: HTMLCanvasElement;
  lctx: CanvasRenderingContext2D;
  ldata: ImageData;
  glow: HTMLCanvasElement;
  gctx: CanvasRenderingContext2D;
  gdata: ImageData;
  particles: Particle[] = [];
  shake = 0;
  bossDim = 0;
  /** How far above the lead the camera centres (more with the touch pad, so the pad covers floor, not faces). */
  lift = 20;
  flash = { color: '#fff', n: 0 };
  pulses: { x: number; y: number; r: number; c: [number, number, number]; t: number }[] = [];
  t = 0;
  /** draw every hitbox over the picture */
  debug = false;
  reduceFlash = false;
  shakeOn = true;
  bossName = { text: '', t: 0 };
  // ─── the heroes' animation ──────────────────────────────────────────────
  anims: Record<HeroId, HeroAnimator> = { dora: new HeroAnimator('dora', 1), enzo: new HeroAnimator('enzo', 2) };
  /** what each hero's animator answered last: read by the browser tests */
  heroAnim: Partial<Record<HeroId, AnimOut>> = {};
  /** one-off moments for each hero's next animation step (rest, chest, relic, ring, read, shop, chime, tagOut, revive) */
  animEvents: Record<HeroId, string[]> = { dora: [], enzo: [] };
  pendingTag = false;
  pendingDown: HeroId | null = null;
  /** a knocked-out hero, slumped where they fell, fading */
  koMarks: { hero: HeroId; x: number; y: number; t: number; flip: boolean }[] = [];
  /** the dash's afterimages */
  ghosts: { hero: HeroId; frame: number; x: number; y: number; flip: boolean; t: number }[] = [];
  followerWas = { x: 0, y: 0 };
  wasDown: Record<HeroId, boolean> = { dora: false, enzo: false };
  leadNow: HeroId = 'dora';
  // ─── numbers that pop off hits ──────────────────────────────────────────
  numbersOn = true;
  /** a journey between shrines, in ticks (0-30 fading out where they knelt, 30-60 fading in at the new candle), or -1 */
  travelFx = -1;
  travelSeen = -1;
  nums: { x: number; y: number; n: number; kind: NumKind; t: number; dx: number }[] = [];
  // ─── the moving world ───────────────────────────────────────────────────
  /** decor drawn every frame instead of into the room picture: swaying bells, chains, banners and reeds, and flames */
  live: { i: number; x: number; y: number; a: number; mode: Sway; amp: number; ph: number; flames: [number, number, number, number][]; candle: boolean }[] = [];
  /** doors opening and walls crumbling (ticks since), chests opening, water bells swinging */
  opening = new Map<string, number>();
  wasOpen = new Map<string, boolean>();
  chestT = new Map<string, number>();
  bellSwing = new Map<string, number>();
  glassA = new Map<string, number>();
  chunks: { x: number; y: number; vx: number; vy: number; t: number; f: boolean }[] = [];
  ripples: { x: number; y: number; t: number; big: boolean }[] = [];
  wispTrail: { x: number; y: number }[] = [];
  /** how strongly the wisp shows (fades in and out) */
  wispA = 0;
  /** the water surface as drawn: it eases to a new level, with streams pouring in while it rises */
  shownSurf: number | null = null;
  shownSurfRoom = '';
  /** chests already open when a room is first drawn don't replay their opening */
  chestSeen = false;
  levelUps: { hero: HeroId; t: number }[] = [];

  /** The internal picture size; the page picks it to fit the screen (about 270 lines, as wide as the screen's shape). */
  vw = VIEW_W;
  vh = VIEW_H;

  constructor() {
    this.view = document.createElement('canvas');
    this.ctx = this.view.getContext('2d')!;
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d')!;
    this.glow = document.createElement('canvas');
    this.gctx = this.glow.getContext('2d')!;
    this.ldata = this.lctx.createImageData(1, 1);
    this.gdata = this.gctx.createImageData(1, 1);
    this.resize(VIEW_W, VIEW_H);
  }

  resize(w: number, h: number) {
    w = Math.round(w / 2) * 2; h = Math.round(h / 2) * 2;
    if (w === this.view.width && h === this.view.height) return;
    this.vw = w; this.vh = h;
    this.view.width = w; this.view.height = h;
    this.ctx.imageSmoothingEnabled = false;
    this.light.width = w / 2; this.light.height = h / 2;
    this.ldata = this.lctx.createImageData(this.light.width, this.light.height);
    this.glow.width = this.light.width; this.glow.height = this.light.height;
    this.gdata = this.gctx.createImageData(this.glow.width, this.glow.height);
  }

  async load(base = '/art/bellspire/') {
    const names = Object.keys(ART).concat(['parchment', 'dora-parts', 'enzo-parts', ...Object.values(OUTFIT).map((o) => `${o.strip}-parts`)]);
    await Promise.all([...new Set(names)].map((n) => new Promise<void>((res) => {
      const im = new Image();
      im.onload = () => { this.img.set(n, im); res(); };
      im.onerror = () => res();
      im.src = `${base}${n}.webp`;
    })));
    for (const n of ['dora', 'enzo', 'foes', 'boss-frog', 'boss-puma', 'boss-mother', 'boss-hydra', 'hydra-head', 'boss-warden', 'boss-condor', 'boss-clapper-a', 'boss-clapper-b', 'boss-bell', ...Object.values(OUTFIT).map((o) => o.strip)]) {
      const im = this.img.get(n);
      if (!im) continue;
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const x = c.getContext('2d')!;
      x.drawImage(im, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      this.white.set(n, c);
    }
    this.ready = true;
  }

  /** The strip a hero is drawn from in the gear they wear: the painted strip for the starting gear, else a copy with
   *  the coat, blade, staff and lantern recoloured (made once per combination). */
  dressed(hero: HeroId, weapon: string, coat: string): string {
    // the belfry outfits are their own painted strips
    const strip = stripFor(hero, coat);
    if (strip !== hero && !this.img.has(strip)) return this.dressed(hero, weapon, START_LOOK[hero].coat);
    const key = `${strip}@${weapon}@${coat}`;
    if (weapon === START_LOOK[hero].weapon && (strip !== hero || coat === START_LOOK[hero].coat) && !COAT_LOOK[coat]?.shell && !WEAPON_LOOK[weapon]?.blade) return strip;
    if (this.img.has(key)) return key;
    const im = this.img.get(strip), pm = this.img.get(`${strip}-parts`);
    if (!im || !pm || typeof document === 'undefined') return strip;
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    const p = document.createElement('canvas');
    p.width = pm.width; p.height = pm.height;
    const px = p.getContext('2d', { willReadFrequently: true })!;
    px.drawImage(pm, 0, 0);
    const pd = px.getImageData(0, 0, p.width, p.height);
    this.coatBoxes.set(key, dressStrip(d.data, pd.data, c.width, c.height, ART[strip][0], hero, weapon, coat));
    x.putImageData(d, 0, 0);
    this.img.set(key, c);
    return key;
  }

  /** Draw frame `i` of strip `name` with its bottom-middle at (x, y). */
  /** A sprite squashed, stretched or tilted about its feet (the New Game+ attacks' own poses). */
  sprXf(name: string, i: number, x: number, y: number, flip: boolean, alpha: number, white: boolean, fx: SprFx | undefined, sx: number, sy: number, rot = 0) {
    if (sx === 1 && sy === 1 && !rot) { this.spr(name, i, x, y, flip, alpha, white, fx); return; }
    const ctx = this.ctx;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (rot) ctx.rotate(rot); ctx.scale(sx, sy);
    this.spr(name, i, 0, 0, flip, alpha, white, fx);
    ctx.restore();
  }
  spr(name: string, i: number, x: number, y: number, flip = false, alpha = 1, white = false, fx?: SprFx) {
    const base = name.split('@')[0];
    const im = white ? this.white.get(base) : this.img.get(name);
    const a = ART[base];
    if (!im || !a) return;
    const [cw, ch] = a;
    const ctx = this.ctx;
    const dx = Math.round(x - cw / 2), dy = Math.round(y - ch);
    const blit = (src: CanvasImageSource, ox = 0, oy = 0, sx = i * cw) => {
      if (flip) { ctx.save(); ctx.translate(dx + cw - ox, dy + oy); ctx.scale(-1, 1); ctx.drawImage(src, sx, 0, cw, ch, 0, 0, cw, ch); ctx.restore(); }
      else ctx.drawImage(src, sx, 0, cw, ch, dx + ox, dy + oy, cw, ch);
    };
    if (alpha !== 1) ctx.globalAlpha = alpha;
    // a guardian stands out: a second dark outline round its silhouette
    if (fx?.rim) { const dark = this.tint(name, '#05040a'); if (dark) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) blit(dark, ox, oy); }
    blit(im);
    if (fx?.rim) {
      // rim light: the silhouette's upper edge, lit
      const lit = this.tint(name, fx.rim);
      if (lit) {
        const rc = this.rimCanvas, rx = rc.getContext('2d')!;
        if (rc.width < cw || rc.height < ch) { rc.width = Math.max(rc.width, cw); rc.height = Math.max(rc.height, ch); }
        rx.clearRect(0, 0, rc.width, rc.height);
        rx.globalCompositeOperation = 'source-over'; rx.drawImage(lit, i * cw, 0, cw, ch, 0, 0, cw, ch);
        rx.globalCompositeOperation = 'destination-out'; rx.drawImage(this.img.get(name)!, i * cw, 0, cw, ch, 0, 2, cw, ch);
        rx.globalCompositeOperation = 'source-over';
        const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.9; blit(rc, 0, 0, 0); ctx.globalAlpha = ga;
      }
    }
    if (fx?.wash) { const w = this.tint(name, fx.wash); if (w) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.55; blit(w); ctx.globalAlpha = ga; } }
    // a wind-up flashes bright
    if (fx?.tell) { const hot = this.tint(name, '#fff4c0'); if (hot) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.5; blit(hot); ctx.globalAlpha = ga; } }
    if (alpha !== 1) ctx.globalAlpha = 1;
  }
  /** A sheet filled flat with one colour, cached. */
  tint(name: string, color: string): HTMLCanvasElement | null {
    const key = `${name}|${color}`;
    const hit = this.tints.get(key);
    if (hit) return hit;
    const im = this.img.get(name);
    if (!im) return null;
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const x = c.getContext('2d')!;
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    this.tints.set(key, c);
    return c;
  }

  // ─── events from the game ────────────────────────────────────────────────
  handle(events: GameEvent[]) {
    for (const e of events) {
      if (e.k === 'hit') this.burst(e.x, e.y, e.big ? 12 : 7, e.color ?? '#fff6d0', e.big ? 2.6 : 1.8);
      else if (e.k === 'shake') this.shake = Math.max(this.shake, e.n);
      else if (e.k === 'flash') this.flash = { color: e.color, n: e.n };
      else if (e.k === 'pulse') this.pulses.push({ x: e.x, y: e.y, r: e.r, c: e.color, t: 0 });
      else if (e.k === 'bell') { this.burst(e.x, e.y, 14, '#ffd870', 2.4); this.ringBell(e.x, e.y); }
      else if (e.k === 'boss') this.bossName = { text: e.id, t: 180 };
      else if (e.k === 'level') this.levelUps.push({ hero: e.hero, t: 90 });
      else if (e.k === 'sfx' && e.id === 'splash' && e.x !== undefined && e.y !== undefined) { this.burst(e.x, e.y - 4, 10, '#bfe6ff', 2, -1.5); this.ripples.push({ x: e.x, y: e.y, t: 0, big: false }); }
      else if (e.k === 'sfx' && e.id === 'poof' && e.x !== undefined && e.y !== undefined) this.poof(e.x, e.y);
      if (e.k === 'num' && this.numbersOn) this.addNum(e.x, e.y, e.n, e.kind);
      // a Puma Tooth hit: an orange flash
      if (e.k === 'crit') { this.burst(e.x, e.y, 12, '#ff9a2a', 2.2); this.pulses.push({ x: e.x, y: e.y, r: 70, c: [1, 0.55, 0.15], t: 0 }); }
      if (e.k === 'save') this.animEvents[this.leadNow].push('rest');
      else if (e.k === 'bell') this.animEvents[this.leadNow].push('ring');
      else if (e.k === 'mural') this.animEvents[this.leadNow].push('read');
      else if (e.k === 'shop') this.animEvents[this.leadNow].push('shop');
      else if (e.k === 'down') this.pendingDown = e.hero;
      else if (e.k === 'sfx' && e.id === 'chime') this.animEvents[this.leadNow].push('chime');
      else if (e.k === 'sfx' && e.id === 'chest') this.animEvents[this.leadNow].push('chest');
      else if (e.k === 'sfx' && e.id === 'relic') this.animEvents[this.leadNow].push('relic');
      else if (e.k === 'sfx' && e.id === 'tag') this.pendingTag = true;
    }
  }
  /** Queue a number; numbers that would land on top of each other stack upwards instead. */
  addNum(x: number, y: number, n: number, kind: NumKind) {
    if (n <= 0) return;
    let dy = 0;
    for (const m of this.nums) if (Math.abs(m.x - x) < 18 && Math.abs(m.y - (y - dy)) < 12 && m.t < 30) dy += 12;
    // XP and coins drift off to the side, smaller, so the damage stays readable
    const dx = kind === 'xp' ? -12 : kind === 'coin' ? 12 : 0;
    this.nums.push({ x: x + dx, y: y - dy - (kind === 'xp' || kind === 'coin' ? 6 : 0), n, kind, t: kind === 'xp' || kind === 'coin' ? -6 : 0, dx });
    if (this.nums.length > 24) this.nums.shift();
  }

  /** The numbers, in the pixel font, outlined, rising and fading; never over the lead's face. */
  drawNums(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx, b = g.body;
    const COL: Record<NumKind, string> = { hit: '#ffffff', big: '#ffd94a', spell: '#9fe6ff', hurt: '#ff5a5a', heal: '#6dff8a', xp: '#d6b8ff', coin: '#ffd94a' };
    for (const m of this.nums) {
      m.t++;
      if (m.t < 0) continue;
      const life = m.kind === 'xp' || m.kind === 'coin' ? 50 : 40;
      const rise = m.t < 6 ? m.t * 1.6 : 9.6 + (m.t - 6) * 0.25;
      let x = m.x + ox + (m.kind === 'xp' || m.kind === 'coin' ? m.t * 0.15 * Math.sign(m.dx) : 0), y = m.y + oy - rise;
      // keep clear of the lead's face (the top of the sprite, about 22 to 38 px above the feet)
      const fx = b.x + ox, fy = b.y + oy;
      if (Math.abs(x - fx) < 14 && y > fy - 52 && y < fy - 16) y = fy - 52 - (m.t < 6 ? 0 : (m.t - 6) * 0.25);
      const label = m.kind === 'xp' ? `+${m.n}XP` : m.kind === 'heal' || m.kind === 'coin' ? `+${m.n}` : `${m.n}`;
      // damage and heals at 2×, finishers at 3×, the XP and coin drift at 1× so they stay quieter
      const scale = m.kind === 'big' ? 3 : m.kind === 'xp' || m.kind === 'coin' ? 1 : 2;
      ctx.globalAlpha = Math.max(0, Math.min(1, (life - m.t) / 10));
      this.numText(label, x, y, COL[m.kind], scale);
      if (m.kind === 'coin') { const w = label.length * 4 * scale; ctx.fillStyle = '#7a4a10'; ctx.fillRect(Math.round(x + w / 2 + 1), Math.round(y), 4, 5); ctx.fillStyle = '#ffd040'; ctx.fillRect(Math.round(x + w / 2 + 2), Math.round(y) + 1, 2, 3); }
      ctx.globalAlpha = 1;
    }
    this.nums = this.nums.filter((m) => m.t < (m.kind === 'xp' || m.kind === 'coin' ? 50 : 40));
  }

  /** The 3×5 pixel font at a whole-number scale, with a dark outline all round. */
  numText(s: string, x: number, y: number, color: string, k: number) {
    const ctx = this.ctx, w = s.length * 4 * k - k;
    const x0 = Math.round(x - w / 2), y0 = Math.round(y);
    for (const [col, offs] of [['#1a1020', [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]], [color, [[0, 0]]]] as const) {
      ctx.fillStyle = col;
      let px = x0;
      for (const ch of s) {
        const gl = GLYPHS[ch] ?? GLYPHS[' '];
        for (let i = 0; i < 15; i++) if (gl[i] === '1') for (const [dx, dy] of offs) ctx.fillRect(px + (i % 3) * k + dx, y0 + Math.floor(i / 3) * k + dy, k, k);
        px += 4 * k;
      }
    }
  }

  /** A water bell was rung near (x, y): it swings for a moment. */
  ringBell(x: number, y: number) {
    let best = '', d = 1e9;
    for (const r of ROOMS) if (r.id === this.roomId) for (const t of INFO.get(r.id)!.things) if (t.ch === 'B') {
      const dd = Math.hypot(t.c * TILE + 8 - x, (t.r + 1) * TILE - 20 - y);
      if (dd < d) { d = dd; best = `${t.c},${t.r}`; }
    }
    if (best && d < 80) this.bellSwing.set(best, 90);
  }

  /** A foe calmed: a soft round cloud that puffs out and drifts up, with a couple of little stars. No harm shown. */
  poof(x: number, y: number) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, s = 0.7 + Math.random() * 0.5;
      this.particles.push({ x: x + Math.cos(a) * 3, y: y - 10 + Math.sin(a) * 3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - 0.3, life: 0, max: 26 + Math.random() * 8, color: i % 3 ? '#f2eeff' : '#d8d0f0', size: 3, g: -0.01, light: true });
    }
    for (let i = 0; i < 3; i++) this.particles.push({ x: x + (i - 1) * 6, y: y - 16, vx: (i - 1) * 0.4, vy: -0.9, life: 0, max: 30, color: '#ffe9a0', size: 2, g: 0, light: true });
  }

  /** Dust, puffs and splashes at the feet, as the animator asks. */
  dust(out: AnimOut, x: number, y: number) {
    const puff = (n: number, spread: number, up: number, color: string, size = 2) => {
      for (let i = 0; i < n; i++) {
        const d = i % 2 ? 1 : -1;
        this.particles.push({ x: x + d * (2 + Math.random() * spread), y: y - 1, vx: d * (0.3 + Math.random() * 0.6), vy: -up * (0.3 + Math.random()), life: 0, max: 14 + Math.random() * 10, color, size, g: 0.02 });
      }
    };
    if (out.dust === 'skid') this.particles.push({ x: x - (out.flip ? -6 : 6), y: y - 1, vx: (out.flip ? 1 : -1) * 0.5, vy: -0.4, life: 0, max: 14, color: '#cdbfa8', size: 2, g: 0.02 });
    else if (out.dust === 'land') puff(4, 4, 0.6, '#cdbfa8');
    else if (out.dust === 'hard') puff(10, 8, 1, '#d8ccb6', 3);
    else if (out.dust === 'splash') puff(5, 3, 2.2, '#bfe6ff', 1);
    else if (out.dust === 'step' && Math.random() < 0.5) puff(1, 2, 0.4, '#b8ac98', 1);
  }

  burst(x: number, y: number, n: number, color: string, speed: number, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + up, life: 0, max: 18 + Math.random() * 14, color, size: Math.random() < 0.3 ? 2 : 1, g: 0.08, light: true });
    }
  }

  // ─── the room's still parts, drawn once ──────────────────────────────────
  buildRoom(room: Room) {
    const rr = roomRect(room);
    const c = document.createElement('canvas');
    c.width = rr.w; c.height = rr.h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const set = TILESET(room), tiles = this.img.get(`tiles-${set}`), dec = DECOR[set];
    const c0 = room.gx * COLS, r0 = room.gy * ROWS, W = room.w * COLS, H = room.h * ROWS;
    const T = (i: number, x: number, y: number, a = 1) => { if (!tiles) return; if (a !== 1) ctx.globalAlpha = a; ctx.drawImage(tiles, i * 16, 0, 16, 16, x, y, 16, 16); if (a !== 1) ctx.globalAlpha = 1; };
    const solid = (x: number, y: number) => SOLIDISH.includes(rawChar(c0 + x, r0 + y)) && rawChar(c0 + x, r0 + y) !== '^';
    const air = (x: number, y: number) => !solid(x, y);
    // the back wall, with pillars every so often
    const back = room.dark ? Math.max(dec.back, 0.8) : dec.back;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!air(x, y)) continue;
      if (back > 0) T(6, x * 16, y * 16, back);
      // (the Belfry Loft's middle layer has its own posts and beams: no extra pillars standing in front of it)
      if (back > 0 && set !== 'loft' && (c0 + x) % 12 === 6) T(7, x * 16, y * 16, Math.min(1, back + 0.25));
    }
    // decor sprinkled on the back wall
    const decor = this.img.get(`decor-${set}`);
    const things = new Set(INFO.get(room.id)!.things.map((t) => `${t.c},${t.r}`));
    this.live = [];
    const D = (i: number, x: number, y: number, a = 1) => {
      const art = ART[`decor-${set}`];
      if (!decor || !art || i < 0) return;
      // decor that sways or burns is drawn every frame (drawLive), not baked into the room
      const mode = SWAY[set]?.[i], flames = FLAMES[`decor-${set}`]?.[i] ?? [];
      if (mode || flames.length) {
        this.live.push({ i, x, y, a, mode: mode ?? 'still', amp: 0, ph: hash(Math.round(x), Math.round(y)) % 100, flames, candle: i === dec.candle });
        return;
      }
      ctx.globalAlpha = a;
      ctx.drawImage(decor, i * art[0], 0, art[0], art[1], Math.round(x - art[0] / 2), Math.round(y - art[1]), art[0], art[1]);
      ctx.globalAlpha = 1;
    };
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (things.has(`${c0 + x},${r0 + y}`) || DOOR_CHARS.includes(rawChar(c0 + x, r0 + y))) continue;
      const h = hash(c0 + x, r0 + y);
      if (air(x, y) && solid(x, y + 1) && air(x - 1, y) && air(x + 1, y) && rawChar(c0 + x, r0 + y) === '.' && dec.floor.length && h % 23 === 0) D(dec.floor[h % dec.floor.length], x * 16 + 8, (y + 1) * 16);
      else if (air(x, y) && solid(x, y - 1) && air(x, y + 1) && air(x, y + 2) && dec.ceil.length && h % 29 === 0) D(dec.ceil[h % dec.ceil.length], x * 16 + 8, y * 16 + (ART[`decor-${set}`]?.[1] ?? 60));
      else if (air(x, y) && air(x, y + 1) && air(x, y - 1) && air(x - 1, y) && air(x + 1, y) && solid(x, y + 3) && dec.wall.length && h % 41 === 0) D(dec.wall[h % dec.wall.length], x * 16 + 8, (y + 2) * 16, 0.9);
    }
    // the map marks that are part of the walls
    for (const t of INFO.get(room.id)!.things) {
      const x = (t.c - c0) * 16 + 8, y = (t.r - r0 + 1) * 16;
      if (t.ch === 'T') {
        const fy = postFloor(room, t.c, t.r);
        if (fy !== null) D(dec.torch, x, fy - r0 * 16);
        else {
          D(dec.torch, x, y + 4);
          // a hanging lantern (the loft) hangs from a chain to the beam or stone over it
          if (set === 'loft') { const up = ceilingAbove(t.c, t.r); if (up) this.drawChain(ctx, x, y + 4 - 28, y - 16 - up * 16); } // (the lantern is painted 30 px tall)
        }
      }
      // a bell hook hangs from a chain to the stone over it (its sprite is drawn live, from the top of its tile)
      else if (t.ch === 'o') { const up = ceilingAbove(t.c, t.r); if (up) this.drawChain(ctx, x, y - 16 + 2, y - 16 - up * 16); }
      else if (t.ch === 'i') D(dec.candle >= 0 ? dec.candle : 0, x, y);
      else if (t.ch === 'w') { if (dec.window >= 0) D(dec.window, x, y + 16); else this.drawWindow(ctx, x, y); }
      else if (t.ch === 'h') D(dec.bell >= 0 ? dec.bell : 0, x, y + 24);
      else if (t.ch === 'v') { const p = this.img.get('props'), a = ART.props; if (p && a) ctx.drawImage(p, 6 * a[0], 0, a[0], a[1], x - a[0] / 2, y - a[1], a[0], a[1]); }
    }
    // the solid tiles
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = rawChar(c0 + x, r0 + y);
      if (ch === '#') {
        const top = air(x, y - 1) && y > 0, under = air(x, y + 1) && y < H - 1;
        const h = hash(c0 + x, r0 + y);
        // (the Cloudstair's stone has a second top and a second fill, in slots its open sky leaves free)
        const alt = set === 'cloud' && (h >> 4) % 3 === 0;
        T(top ? (alt ? 6 : 0) : under ? 8 : h % 9 === 0 ? 2 : alt ? 7 : 1, x * 16, y * 16);
        // edge shading so stone reads as solid mass
        if (!top && !under && (air(x - 1, y) || air(x + 1, y))) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(air(x - 1, y) ? x * 16 : x * 16 + 15, y * 16, 1, 16); }
      } else if (ch === '=') T(3, x * 16, y * 16);
      else if (ch === 'H') T(4, x * 16, y * 16);
      else if (ch === '^') this.drawSpikes(ctx, x * 16, y * 16);
    }
    this.roomCanvas = c;
    this.roomId = room.id;
    // in dark rooms, a faint line along every floor, ledge and wall edge, drawn over the light so the way is never a guess
    this.edgeCanvas = null;
    if (room.dark) {
      const e = document.createElement('canvas');
      e.width = rr.w; e.height = rr.h;
      const ex = e.getContext('2d')!;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ch = room.rows[y][x];
        if (ch === '=') { ex.fillStyle = 'rgba(200,190,240,0.32)'; ex.fillRect(x * 16, y * 16, 16, 1); continue; }
        if (!solid(x, y)) continue;
        ex.fillStyle = 'rgba(200,190,240,0.28)';
        if (y > 0 && air(x, y - 1)) ex.fillRect(x * 16, y * 16, 16, 1);
        ex.fillStyle = 'rgba(200,190,240,0.14)';
        if (x > 0 && air(x - 1, y)) ex.fillRect(x * 16, y * 16, 1, 16);
        if (x < W - 1 && air(x + 1, y)) ex.fillRect(x * 16 + 15, y * 16, 1, 16);
        if (y < H - 1 && air(x, y + 1)) ex.fillRect(x * 16, y * 16 + 15, 16, 1);
      }
      this.edgeCanvas = e;
    }
  }
  drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#1c2a40'; ctx.fillRect(x - 8, y - 40, 16, 32);
    ctx.fillStyle = '#4a78a8'; ctx.fillRect(x - 6, y - 38, 12, 28);
    ctx.fillStyle = '#8fc0e8'; ctx.fillRect(x - 4, y - 36, 3, 10);
  }
  /** An iron chain from (x, yBottom) straight up to yTop (room-canvas pixels): links seen face-on and edge-on in turn,
   *  with a bracket where it meets the stone. */
  drawChain(ctx: CanvasRenderingContext2D, x: number, yBottom: number, yTop: number) {
    x = Math.round(x);
    for (let y = Math.round(yTop), k = 0; y < yBottom; y += 4, k++) {
      if (k % 2 === 0) {
        ctx.fillStyle = '#231d1a'; ctx.fillRect(x - 2, y, 4, 5);
        ctx.fillStyle = '#6b5d50'; ctx.fillRect(x - 1, y + 1, 1, 3); ctx.fillRect(x + 1, y + 1, 1, 3);
        ctx.fillStyle = '#231d1a'; ctx.fillRect(x, y + 1, 1, 3);
      } else {
        ctx.fillStyle = '#231d1a'; ctx.fillRect(x - 1, y, 2, 5);
        ctx.fillStyle = '#93826e'; ctx.fillRect(x - 1, y + 1, 1, 3);
      }
    }
    // the bracket bolted to the stone
    ctx.fillStyle = '#231d1a'; ctx.fillRect(x - 5, Math.round(yTop), 10, 4);
    ctx.fillStyle = '#7d6c5a'; ctx.fillRect(x - 4, Math.round(yTop), 8, 2);
    ctx.fillStyle = '#b8a487'; ctx.fillRect(x - 4, Math.round(yTop), 1, 1); ctx.fillRect(x + 3, Math.round(yTop), 1, 1);
  }

  drawSpikes(ctx: CanvasRenderingContext2D, x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      const sx = x + i * 4;
      ctx.fillStyle = '#3a2a26'; ctx.fillRect(sx, y + 6, 4, 10);
      ctx.fillStyle = '#c9a46a'; ctx.fillRect(sx + 1, y + 8, 2, 8); ctx.fillRect(sx + 1, y + 6, 1, 2);
      ctx.fillStyle = '#f2dca0'; ctx.fillRect(sx + 1, y + 9, 1, 5);
    }
    ctx.fillStyle = '#5a4030'; ctx.fillRect(x, y + 14, 16, 2);
  }

  // ─── the frame ───────────────────────────────────────────────────────────
  draw(g: BellspireGame) {
    const ctx = this.ctx;
    this.t++;
    if (!this.ready) { ctx.fillStyle = '#0b0a12'; ctx.fillRect(0, 0, this.vw, this.vh); return; }
    const room = g.room;
    if (this.roomId !== room.id || !this.roomCanvas) { this.buildRoom(room); this.particles = []; this.snapCam(g); this.chestSeen = false; this.chestT.clear(); this.wasOpen.clear(); this.opening.clear(); this.ripples = []; this.chunks = []; this.wispTrail = []; }
    const rr = roomRect(room);
    // the camera follows the lead, a little ahead, and never leaves the room; in a boss fight it looks at the guardian
    // while it introduces itself, then leans towards it (keeping the lead well inside the picture)
    const b = g.body, boss = g.boss;
    let fx = b.x + b.face * 24;
    if (boss && !boss.calm && boss.st === 'intro') fx = boss.x;
    else if (boss && !boss.calm && boss.st !== 'wait') fx = clamp((b.x + boss.x) / 2, b.x - this.vw / 2 + 70, b.x + this.vw / 2 - 70);
    const tx = camClamp(fx - this.vw / 2, rr.x, rr.w, this.vw);
    const ty = camClamp(b.y - this.lift - this.vh / 2, rr.y, rr.h, this.vh);
    this.cam.x += (tx - this.cam.x) * 0.14; this.cam.y += (ty - this.cam.y) * 0.14;
    let cx = Math.round(this.cam.x), cy = Math.round(this.cam.y);
    if (this.shake > 0 && this.shakeOn) { cx += Math.round((Math.random() - 0.5) * this.shake); cy += Math.round((Math.random() - 0.5) * this.shake); }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.6);
    const set = TILESET(room);

    // far backdrop and mid silhouettes, with parallax
    const bg = this.img.get(`bg-${set}`);
    const px = rr.w > this.vw ? (this.cam.x - rr.x) / (rr.w - this.vw) : 0.5, py = rr.h > this.vh ? (this.cam.y - rr.y) / (rr.h - this.vh) : 0.5;
    if (bg) {
      // cover the whole view, with a little room to drift for parallax
      const k = Math.max((this.vw + 32) / 480, (this.vh + 20) / 270), bw = Math.round(480 * k), bh = Math.round(270 * k);
      ctx.drawImage(bg, 0, 0, 480, 270, Math.round(-(bw - this.vw) * px), Math.round(-(bh - this.vh) * py), bw, bh);
    }
    else { ctx.fillStyle = '#16141f'; ctx.fillRect(0, 0, this.vw, this.vh); }
    const mid = this.img.get(`mid-${set}`);
    if (mid) { const ox = -(((cx * 0.35) % 480) + 480) % 480, oy = Math.round(-20 * py + 8 + (this.vh - 270) / 2); for (let x = Math.round(ox); x < this.vw; x += 480) ctx.drawImage(mid, x, oy); }

    // the room
    ctx.drawImage(this.roomCanvas!, rr.x - cx, rr.y - cy);
    // in a boss fight the room behind the action sinks into shadow, so the guardian stands out from the busy scenery
    const fighting = !!g.boss && !g.boss.calm && g.boss.st !== 'wait';
    this.bossDim += ((fighting ? 1 : 0) - this.bossDim) * 0.05;
    if (this.bossDim > 0.01) {
      // drain most of the colour, then darken
      ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${(this.bossDim * 0.7).toFixed(3)})`; ctx.fillRect(0, 0, this.vw, this.vh);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(6,8,16,${(this.bossDim * 0.5).toFixed(3)})`; ctx.fillRect(0, 0, this.vw, this.vh);
    }
    const ox = -cx, oy = -cy;
    this.drawDynamicTiles(g, ox, oy);
    this.drawLive(g, ox, oy);
    this.drawThings(g, ox, oy);
    this.drawBelfry(g, ox, oy);
    this.drawPickups(g, ox, oy);
    this.drawEnemies(g, ox, oy);
    if (g.boss) this.drawBoss(g, g.boss, ox, oy);
    if (g.trial?.def.kind === 'run') this.drawTrialBells(g, ox, oy);
    this.drawHeroes(g, ox, oy);
    this.drawShots(g, ox, oy);
    this.drawWater(g, ox, oy);
    if (g.boss) this.drawWarnings(g, ox, oy);
    this.drawParticles(ox, oy);

    // light
    this.drawLight(g, cx, cy);
    // the guided rope's marks (the helping hand) stay bright in the dark: they're a guide, not part of the room
    this.drawRopeGuide(g, ox, oy);
    if (this.edgeCanvas) ctx.drawImage(this.edgeCanvas, rr.x - cx, rr.y - cy);
    // beyond a room smaller than the view: the dark
    {
      const x0 = rr.x - cx, y0 = rr.y - cy, x1 = x0 + rr.w, y1 = y0 + rr.h;
      ctx.fillStyle = '#07060c';
      if (x0 > 0) ctx.fillRect(0, 0, x0, this.vh);
      if (x1 < this.vw) ctx.fillRect(x1, 0, this.vw - x1, this.vh);
      if (y0 > 0) ctx.fillRect(0, 0, this.vw, y0);
      if (y1 < this.vh) ctx.fillRect(0, y1, this.vw, this.vh - y1);
    }
    this.drawRays(g, ox, oy);

    // over the light: the wisp, rings, flashes and labels
    // the guiding wisp: a small soft glow with a short trail; faint while someone talks or a guardian fights
    const wispWant = g.wisp.on ? (g.dialog ? 0.15 : g.boss ? 0.3 : 1) : 0;
    this.wispA += (wispWant - this.wispA) * 0.08;
    if (this.wispA > 0.02) {
      const bob = Math.sin(this.t * 0.1) * 2, wx = Math.round(g.wisp.x + ox), wy = Math.round(g.wisp.y + oy + bob), a = this.wispA;
      if (this.t % 3 === 0) { this.wispTrail.push({ x: g.wisp.x, y: g.wisp.y + bob }); if (this.wispTrail.length > 6) this.wispTrail.shift(); }
      this.wispTrail.forEach((p, i) => { ctx.fillStyle = `rgba(190,245,255,${((i + 1) / this.wispTrail.length * 0.45 * a).toFixed(2)})`; ctx.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), 1, 1); });
      const glow = ctx.createRadialGradient(wx, wy, 0, wx, wy, 9);
      glow.addColorStop(0, `rgba(200,250,255,${(0.55 * a).toFixed(2)})`); glow.addColorStop(1, 'rgba(160,230,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(wx - 9, wy - 9, 18, 18);
      ctx.fillStyle = `rgba(150,235,255,${(0.8 * a).toFixed(2)})`; ctx.fillRect(wx - 1, wy - 2, 3, 5); ctx.fillRect(wx - 2, wy - 1, 5, 3);
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`; ctx.fillRect(wx, wy - 1, 1, 3); ctx.fillRect(wx - 1, wy, 3, 1);
    } else this.wispTrail = [];
    for (const r of g.rings) { ctx.strokeStyle = r.friendly ? (r.kind === 'chime' && WEAPON_LOOK[this.worn.enzo.weapon]?.ring) || 'rgba(255,220,130,0.85)' : 'rgba(230,120,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Math.round(r.x + ox), Math.round(r.y + oy), r.r, 0, Math.PI * 2); ctx.stroke(); }
    for (const p of this.pulses) {
      p.t++;
      const k = p.t / 24;
      ctx.strokeStyle = `rgba(${p.c.map((v) => Math.round(v * 255)).join(',')},${Math.max(0, 0.5 * (1 - k))})`;
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(p.x + ox), Math.round(p.y + oy), p.r * Math.min(1, k * 1.4) * 0.5, 0, Math.PI * 2); ctx.stroke();
    }
    this.pulses = this.pulses.filter((p) => p.t < 24);
    for (const l of this.levelUps) { l.t--; const hx = l.hero === g.lead ? b.x : g.follower.x, hy = (l.hero === g.lead ? b.y : g.follower.y) - 46 - (90 - l.t) * 0.2; this.text('LV UP!', hx + ox, hy + oy, l.t > 70 || this.t % 8 < 6 ? '#ffe27a' : '#fff'); }
    this.levelUps = this.levelUps.filter((l) => l.t > 0);
    this.drawNums(g, ox, oy);
    if (this.debug) this.drawDebug(g, ox, oy);
    if (this.flash.n > 0) {
      if (!this.reduceFlash) { ctx.globalAlpha = Math.min(0.6, this.flash.n / 20); ctx.fillStyle = this.flash.color; ctx.fillRect(0, 0, this.vw, this.vh); ctx.globalAlpha = 1; }
      this.flash.n--;
    }
  }
  /** The hitbox overlay (?hitboxes=1, or __bellspire().debug(true)): green where things can be hit, red where they
   *  hurt, cyan the lead hero, yellow the lead's attack. */
  drawDebug(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx;
    const box = (r: { x: number; y: number; w: number; h: number }, c: string) => { ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.strokeRect(Math.round(r.x + ox) + 0.5, Math.round(r.y + oy) + 0.5, Math.max(1, Math.round(r.w) - 1), Math.max(1, Math.round(r.h) - 1)); };
    for (const e of g.enemies) {
      if (!e.alive || e.hidden) continue;
      box(g.foeRect(e), '#3dff6e'); box(g.contactRect(e), '#ff4a4a');
      if (e.st === 'strike' && e.kind !== 'golem' && e.t < 12) box(g.strikeRect(e), '#ff4a4a');
    }
    if (g.boss) { for (const r of g.boss.hurt) box(r, '#3dff6e'); for (const r of g.boss.harm) box(r, '#ff4a4a'); }
    for (const w of g.waves) box({ x: w.x - 6, y: w.y - w.h, w: 12, h: w.h }, '#ff4a4a');
    for (const r of g.rings) if (!r.friendly) { ctx.strokeStyle = '#ff4a4a'; ctx.beginPath(); ctx.arc(r.x + ox, r.y + oy, Math.max(0, r.r - r.thick / 2), 0, Math.PI * 2); ctx.arc(r.x + ox, r.y + oy, r.r + r.thick / 2, 0, Math.PI * 2); ctx.stroke(); }
    for (const s of g.shots) { ctx.strokeStyle = s.friendly ? '#ffe14a' : '#ff4a4a'; ctx.beginPath(); ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2); ctx.stroke(); }
    box(g.leadRect(), '#4ae8ff');
    const a = g.attackBox();
    if (a) box(a.r, '#ffe14a');
  }

  snapCam(g: BellspireGame) {
    const rr = roomRect(g.room), b = g.body;
    this.cam.x = camClamp(b.x + b.face * 24 - this.vw / 2, rr.x, rr.w, this.vw);
    this.cam.y = camClamp(b.y - this.lift - this.vh / 2, rr.y, rr.h, this.vh);
  }
  text(s: string, x: number, y: number, color: string) {
    const ctx = this.ctx;
    const w = s.length * 4 - 1;
    let px = Math.round(x - w / 2);
    for (const ch of s) {
      const gl = GLYPHS[ch] ?? GLYPHS[' '];
      for (let i = 0; i < 15; i++) if (gl[i] === '1') {
        ctx.fillStyle = '#1a1020'; ctx.fillRect(px + (i % 3) + 1, Math.round(y) + Math.floor(i / 3) + 1, 1, 1);
        ctx.fillStyle = color; ctx.fillRect(px + (i % 3), Math.round(y) + Math.floor(i / 3), 1, 1);
      }
      px += 4;
    }
  }

  drawDynamicTiles(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx, room = g.room, info = INFO.get(room.id)!;
    const tiles = this.img.get(`tiles-${TILESET(room)}`);
    // breakable walls
    for (const w of info.walls) {
      const broken = g.wallBroken(w), was = this.wasOpen.get(w.id);
      this.wasOpen.set(w.id, broken);
      // it just broke: it crumbles into tumbling pieces and dust
      if (broken && was === false) for (const [c, r] of w.tiles) {
        for (let i = 0; i < 3; i++) this.chunks.push({ x: c * TILE + 4 + Math.random() * 8, y: r * TILE + 4 + Math.random() * 8, vx: (Math.random() - 0.5) * 2.4, vy: -1.5 - Math.random() * 1.5, t: 0, f: Math.random() < 0.5 });
        this.burst(c * TILE + 8, r * TILE + 8, 6, '#b8a890', 1.2);
      }
      if (broken) continue;
      for (const [c, r] of w.tiles) if (tiles) ctx.drawImage(tiles, 5 * 16, 0, 16, 16, c * TILE + ox, r * TILE + oy, 16, 16);
    }
    const props = this.img.get('props'), pa = ART.props;
    for (const k of this.chunks) {
      k.t++; k.vy += 0.18; k.x += k.vx; k.y += k.vy;
      if (props && pa) { ctx.globalAlpha = Math.max(0, 1 - k.t / 50); ctx.drawImage(props, 9 * pa[0] + pa[0] / 2 - 6, pa[1] - 10, 12, 10, Math.round(k.x + ox - 3), Math.round(k.y + oy - 3), 6, 5); ctx.globalAlpha = 1; }
    }
    this.chunks = this.chunks.filter((k) => k.t < 50);
    // doors and hatches
    for (const d of info.doors) {
      const open = g.doorOpen(d), was = this.wasOpen.get(d.id);
      this.wasOpen.set(d.id, open);
      if (open && was === false) this.opening.set(d.id, 0);
      const x = d.c * TILE + ox, y = d.r * TILE + oy, w = d.w * TILE, h = d.h * TILE;
      const ab = ({ d: 'dash', j: 'double', k: 'wallkick', l: 'lantern', c: 'chime', y: 'rope', n: 'echo' } as Record<string, keyof typeof ABILITIES>)[d.ch];
      const col = ab ? ABILITIES[ab].color : d.ch === 'u' ? '#c9a46a' : d.ch === 'Z' ? '#9fc4ff' : '#b85050';
      // opening: the rune blazes for a moment, then the door slides away into the wall (a hatch, sideways)
      const ot = this.opening.get(d.id);
      if (open && ot !== undefined && ot < 40) {
        this.opening.set(d.id, ot + 1);
        const k = ot < 12 ? 0 : (ot - 12) / 28, ease = k * k * (3 - 2 * k);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        const dx = d.horiz ? -w * ease : 0, dy = d.horiz ? 0 : -h * ease;
        ctx.fillStyle = '#231a1e'; ctx.fillRect(x + dx, y + dy, w, h);
        ctx.fillStyle = '#5a4436'; ctx.fillRect(x + dx + 1, y + dy + 1, w - 2, h - 2);
        ctx.fillStyle = col; ctx.globalAlpha = ot < 12 ? 0.5 + 0.5 * Math.sin(ot * 0.9) : 0.6 * (1 - k);
        ctx.fillRect(x + dx, y + dy, w, h); ctx.globalAlpha = 1;
        ctx.restore();
        if (ot >= 12 && ot % 4 === 0) this.burst((d.c + d.w / 2) * TILE, (d.r + (d.horiz ? 0.5 : d.h)) * TILE, 3, '#b8a890', 0.8);
        continue;
      }
      if (open) {
        // an open hatch over a ladder becomes ladder
        if (d.horiz && tiles) for (const [c, r] of d.tiles) if (rawChar(c, r - 1) === 'H' || rawChar(c, r + 1) === 'H') ctx.drawImage(tiles, 4 * 16, 0, 16, 16, c * TILE + ox, r * TILE + oy, 16, 16);
        // a faint frame shows where the door was
        ctx.fillStyle = col; ctx.globalAlpha = 0.35;
        if (d.horiz) { ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h); } else { ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); }
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.fillStyle = '#231a1e'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#5a4436'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = '#3a2c28';
      if (d.horiz) for (let i = 4; i < w; i += 6) ctx.fillRect(x + i, y + 1, 2, h - 2);
      else for (let i = 4; i < h; i += 6) ctx.fillRect(x + 1, y + i, w - 2, 2);
      // the rune: the colour of the ability that opens it, pulsing gently
      const cxr = x + w / 2, cyr = y + h / 2, pulse = 0.65 + 0.35 * Math.sin(this.t * 0.08 + d.c);
      ctx.fillStyle = col; ctx.globalAlpha = pulse;
      if (d.ch === 'b') { for (let i = 3; i < (d.horiz ? w : h); i += 5) d.horiz ? ctx.fillRect(x + i, y + 1, 2, h - 2) : ctx.fillRect(x + 1, y + i, w - 2, 2); }
      else if (d.ch === 'u') {
        ctx.fillRect(x + 1, cyr - 1, w - 2, 3); ctx.fillRect(cxr - 1, y + 1, 3, h - 2);
        // four bell seals, one per guardian in its area's colour: lit once that guardian is calm
        ctx.globalAlpha = 1;
        GUARDIANS.forEach((b, i) => {
          const sx = Math.round(d.horiz ? x + ((i + 0.5) * w) / 4 : cxr) - 3, sy = Math.round(d.horiz ? cyr : y + ((i + 0.5) * h) / 4) - 3, on = g.flag(`boss:${b}`);
          ctx.fillStyle = '#1a1020'; ctx.fillRect(sx, sy, 7, 7);
          ctx.fillStyle = on ? AREAS[GUARDIAN_AREA[b]].color : '#4a3a40'; ctx.fillRect(sx + 1, sy + 1, 5, 5);
          if (on) { ctx.fillStyle = '#fff6d8'; ctx.fillRect(sx + 2, sy + 2, 1, 1); } else { ctx.fillStyle = '#2a2026'; ctx.fillRect(sx + 3, sy + 2, 1, 3); }
        });
      }
      else if (d.ch === 'Z') {
        // the belfry seal: two bell seals, the Hail Condor's and the Twin Clappers', lit once each is calm
        ctx.fillRect(x + 1, cyr - 1, w - 2, 2); ctx.fillRect(cxr - 1, y + 1, 2, h - 2);
        ctx.globalAlpha = 1;
        (['condor', 'clappers'] as const).forEach((b, i) => {
          const sx = Math.round(d.horiz ? x + ((i + 0.5) * w) / 2 : cxr) - 3, sy = Math.round(d.horiz ? cyr : y + ((i + 0.5) * h) / 2) - 3, on = g.flag(`boss:${b}`);
          ctx.fillStyle = '#1a1020'; ctx.fillRect(sx, sy, 7, 7);
          ctx.fillStyle = on ? AREAS[b === 'condor' ? 'cloud' : 'loft'].color : '#4a3a40'; ctx.fillRect(sx + 1, sy + 1, 5, 5);
          if (on) { ctx.fillStyle = '#fff6d8'; ctx.fillRect(sx + 2, sy + 2, 1, 1); } else { ctx.fillStyle = '#2a2026'; ctx.fillRect(sx + 3, sy + 2, 1, 3); }
        });
      } else if (d.ch === 'y') {
        // a rope knot: a loop with a tail
        const X = Math.round(cxr), Y = Math.round(cyr);
        ctx.fillRect(X - 3, Y - 4, 6, 1); ctx.fillRect(X - 3, Y + 1, 6, 1); ctx.fillRect(X - 4, Y - 3, 1, 4); ctx.fillRect(X + 3, Y - 3, 1, 4); ctx.fillRect(X, Y + 2, 1, 4);
        ctx.fillStyle = '#fff'; ctx.fillRect(X - 1, Y - 2, 2, 2);
      } else if (d.ch === 'n') {
        // a note: a stem and a head
        const X = Math.round(cxr), Y = Math.round(cyr);
        ctx.fillRect(X + 1, Y - 5, 1, 7); ctx.fillRect(X - 2, Y + 1, 4, 3); ctx.fillRect(X + 1, Y - 5, 3, 1);
        ctx.fillStyle = '#fff'; ctx.fillRect(X - 1, Y + 2, 1, 1);
      }
      else { ctx.fillRect(Math.round(cxr) - 3, Math.round(cyr) - 3, 6, 6); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(cxr) - 1, Math.round(cyr) - 1, 2, 2); }
      ctx.globalAlpha = 1;
    }
    // ghost-glass: faint until the lantern makes it solid
    const c0 = room.gx * COLS, r0 = room.gy * ROWS;
    for (let y = 0; y < room.h * ROWS; y++) for (let x = 0; x < room.w * COLS; x++) {
      if (rawChar(c0 + x, r0 + y) !== 'g') continue;
      const lit = g.glassLit(c0 + x, r0 + y);
      const px = (c0 + x) * TILE + ox, py = (r0 + y) * TILE + oy;
      const key = `${c0 + x},${r0 + y}`, a0 = this.glassA.get(key) ?? (lit ? 1 : 0), ga = a0 + ((lit ? 1 : 0) - a0) * 0.15;
      this.glassA.set(key, ga);
      if (px < -16 || px > this.vw || py < -16 || py > this.vh) continue;
      if (ga > 0.05) {
        ctx.globalAlpha = ga;
        ctx.fillStyle = 'rgba(150,200,255,0.85)'; ctx.fillRect(px, py, 16, 16);
        ctx.fillStyle = '#e8f4ff'; ctx.fillRect(px, py, 16, 1); ctx.fillRect(px + 2, py + 3, 1, 6);
        ctx.fillStyle = '#5a78c8'; ctx.fillRect(px, py + 15, 16, 1);
        // a glint sweeps across the solid glass
        const sweep = ((this.t * 0.8 + (c0 + x) * 16 - (r0 + y) * 8) % 120) - 20;
        if (sweep >= 0 && sweep < 16) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(px + Math.floor(sweep), py + 1, 2, 14); }
        ctx.globalAlpha = 1;
      }
      if (ga < 0.95) {
        ctx.globalAlpha = 1 - ga;
        ctx.fillStyle = 'rgba(150,200,255,0.16)'; ctx.fillRect(px, py, 16, 16);
        ctx.fillStyle = `rgba(190,220,255,${0.25 + 0.15 * Math.sin(this.t * 0.05 + x)})`;
        for (let i = 0; i < 16; i += 4) { ctx.fillRect(px + i, py, 2, 1); ctx.fillRect(px + i, py + 15, 2, 1); }
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Draw a sprite cell a row at a time, each row shifted sideways by `shift(row from the top, height)`: sway that keeps
   *  the pixels square, where a rotation would smear them. */
  drawSliced(img: Img, sx: number, cw: number, ch: number, dx: number, dy: number, shift: (r: number, h: number) => number, alpha = 1) {
    const ctx = this.ctx;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    for (let r = 0; r < ch; r += 2) ctx.drawImage(img, sx, r, cw, 2, Math.round(dx + shift(r, ch)), dy + r, cw, 2);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  drawLive(g: BellspireGame, ox: number, oy: number) {
    const set = TILESET(g.room), img = this.img.get(`decor-${set}`), art = ART[`decor-${set}`], fl = this.img.get('flames');
    if (!img || !art) return;
    const [cw, ch] = art, b = g.body, box = g.attackBox();
    for (const d of this.live) {
      const x = d.x + ox, y = d.y + oy;
      if (x < -cw || x > this.vw + cw || y < -10 || y > this.vh + ch) continue;
      // bells, chains and banners swing harder when the heroes brush past or strike them
      const near = Math.abs(b.x - d.x) < 14 && b.y > d.y - ch && b.y - 30 < d.y;
      const struck = box && box.r.x < d.x + 8 && box.r.x + box.r.w > d.x - 8 && box.r.y < d.y && box.r.y + box.r.h > d.y - ch;
      if (struck) d.amp = Math.max(d.amp, 5);
      else if (near && Math.abs(b.vx) > 0.5) d.amp = Math.max(d.amp, 2.5);
      d.amp *= 0.985;
      const t = this.t + d.ph * 7, sx = d.i * cw, x0 = Math.round(x - cw / 2), y0 = Math.round(y - ch);
      // find the top of the drawn part, so a pendulum pivots on its hook
      if (d.mode === 'pend') {
        const ang = Math.sin(t * 0.045) * (0.6 + d.amp) * 0.02 + Math.sin(t * 0.09) * d.amp * 0.03;
        this.drawSliced(img, sx, cw, ch, x0, y0, (r) => ang * r, d.a);
      } else if (d.mode === 'cloth') {
        this.drawSliced(img, sx, cw, ch, x0, y0, (r, h) => Math.sin(t * 0.05 + r * 0.12) * (0.8 + d.amp * 0.4) * (r / h), d.a);
      } else if (d.mode === 'plant') {
        this.drawSliced(img, sx, cw, ch, x0, y0, (r, h) => Math.sin(t * 0.03 + d.ph) * 1.4 * ((h - r) / h) ** 1.6, d.a);
      } else {
        if (d.a !== 1) this.ctx.globalAlpha = d.a;
        this.ctx.drawImage(img, sx, 0, cw, ch, x0, y0, cw, ch);
        this.ctx.globalAlpha = 1;
      }
      // flames: painted frames laid over the painted flame, each flickering on its own clock
      if (fl) for (let k = 0; k < d.flames.length; k++) {
        const [fx0, fy0, fx1, fy1] = d.flames[k];
        const f = Math.floor((t + k * 13) / 5 + Math.sin(t * 0.3 + k) * 1.5);
        if (d.candle) {
          // a candle: a small flame on the top of each wick
          const fi = 3 + (((f % 3) + 3) % 3), w = 4, h = 6;
          this.ctx.drawImage(fl, fi * 16, 0, 16, 20, Math.round(x + (fx0 + fx1) / 2 - w / 2), Math.round(y + fy0 - h + 3), w, h);
        } else {
          const fi = ((f % 3) + 3) % 3, w = Math.max(6, (fx1 - fx0) * 1.5), h = Math.max(8, (fy1 - fy0) * 1.6);
          this.ctx.drawImage(fl, fi * 16, 0, 16, 20, Math.round(x + (fx0 + fx1) / 2 - w / 2), Math.round(y + fy1 - h + 1), Math.round(w), Math.round(h));
        }
      }
    }
  }

  drawThings(g: BellspireGame, ox: number, oy: number) {
    const room = g.room;
    for (const t of INFO.get(room.id)!.things) {
      const x = t.c * TILE + 8 + ox, y = (t.r + 1) * TILE + oy;
      if (x < -80 || x > this.vw + 80 || y < -40 || y > this.vh + 80) continue;
      if (t.ch === 'S') this.spr('props', g.flag(`shrine:${room.id}`) || g.save.shrine === room.id ? 1 : 0, x, y);
      else if (t.ch === 'B') {
        // a rung water bell swings, and rings out
        const k = `${t.c},${t.r}`, sw = this.bellSwing.get(k) ?? 0;
        const im = this.img.get('props'), a = ART.props;
        if (sw > 0 && im && a) {
          this.bellSwing.set(k, sw - 1);
          const ang = Math.sin((90 - sw) * 0.25) * (sw / 90) * 0.12;
          this.drawSliced(im, 2 * a[0], a[0], a[1], Math.round(x - a[0] / 2), Math.round(y - a[1]), (r) => ang * Math.max(0, r - a[1] * 0.25));
          if (sw % 18 === 0) this.ripples.push({ x: x - ox, y: y - oy - 26, t: 0, big: true });
        } else this.spr('props', 2, x, y);
      } else if (t.ch === 'C') {
        // a chest opens: the lid half up and light spilling out, then wide open
        const k = `${room.id}:${t.i}`, open = g.flag(`chest:${k}`);
        if (open && !this.chestT.has(k)) { this.chestT.set(k, this.chestSeen ? 0 : 99); if (this.chestSeen) this.burst(x - ox, y - oy - 10, 10, '#ffe6a0', 1.4, -0.8); }
        if (!open) this.chestT.delete(k);
        const ct = this.chestT.get(k) ?? 99;
        if (open && ct < 99) this.chestT.set(k, ct + 1);
        this.spr('props', !open ? 3 : ct < 10 ? 8 : 4, x, y);
      }
      else if (t.ch === 'R') {
        this.spr('props', 7, x, y);
        const n = room.murals?.[t.i] ?? 0;
        if (!g.flag(`mural:${n}`) && this.t % 60 < 40) { this.ctx.fillStyle = '#ffe27a'; this.ctx.fillRect(x - 1, y - 38, 2, 2); }
      } else if (t.ch === 'o') this.spr('props2', 0, x, t.r * TILE + oy + 18); // hung from the top of its tile
      else if (t.ch === 'Q') {
        // an echo bell glows while its notes hang in the air
        const lit = g.notes.some((n) => n.key.startsWith(`${room.id}:${t.i}:`));
        this.spr('props2', lit ? 2 : 1, x, y);
      } else if (t.ch === 'W') {
        // a wind bell: its streamers fly the way the wind blows (the art's frame 3 blows east), swinging a while when rung
        const area = room.area as 'cloud' | 'loft', east = (g.save.wind[area] ?? 1) > 0;
        const k = `w${t.c},${t.r}`, was = this.wasOpen.get(k);
        this.wasOpen.set(k, east);
        if (was !== undefined && was !== east) this.bellSwing.set(k, 40);
        const sw = this.bellSwing.get(k) ?? 0;
        if (sw > 0) this.bellSwing.set(k, sw - 1);
        this.spr('props2', sw > 0 && sw % 10 < 5 ? (east ? 4 : 3) : east ? 3 : 4, x + Math.round(Math.sin(sw * 0.5) * (sw / 20)), y);
      } else if (t.ch === 'D') this.spr('props2', 6, x + 12, y + 6);
      else if (t.ch === 'M') this.spr('npcs', Math.floor(this.t / 40) % 2, x, y + 2, g.body.x > x - ox);
      else if (t.ch === 'U') this.spr('npcs', 2 + (Math.floor(this.t / 50) % 2), x, y + Math.sin(this.t * 0.04) * 2, g.body.x < x - ox, 0.85);
      else if (t.ch === 'A') {
        const ctx = this.ctx;
        ctx.fillStyle = '#3a2c34'; ctx.fillRect(x - 10, y - 10, 20, 10);
        ctx.fillStyle = '#7a6670'; ctx.fillRect(x - 9, y - 10, 18, 2); ctx.fillRect(x - 7, y - 6, 14, 1);
        if (room.ability && !g.has(room.ability)) this.spr('npcs', 7, x, y - 16 + Math.sin(this.t * 0.06) * 3);
      }
    }
    // the coin bag after a wipe
    this.chestSeen = true;
  }

  /** The guided Bell Rope (the helping hand): in the air, the hook that will catch Dora glows and pulses, with a faint
   *  rope to it (a hook a little beyond reach glows faintly); on the rope, a dotted arc to where a jump would take her
   *  and a mark there; in flight, the mark she's flying to. */
  drawRopeGuide(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx, b = g.body, { hook, aim } = g.ropeGuide;
    if (g.lead !== 'dora' || (!hook && !aim && !b.fly)) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 0.18);
    ctx.save();
    if (hook) {
      const x = Math.round(hook.x + ox), y = Math.round(hook.y + oy);
      const far = hook.far;
      const r = far ? 7 : 8 + pulse * 3;
      const glow = ctx.createRadialGradient(x, y, 1, x, y, r + 8);
      glow.addColorStop(0, `rgba(255,226,140,${far ? 0.25 : 0.55 + pulse * 0.25})`); glow.addColorStop(1, 'rgba(255,200,90,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r + 8, 0, Math.PI * 2); ctx.fill();
      if (!far) {
        ctx.strokeStyle = `rgba(255,236,170,${0.6 + pulse * 0.4})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2); ctx.stroke();
        // a faint rope from her hand: where the catch will be
        const hx = b.x + ox + b.face * 2, hy = b.y - HERO_H - 6 + oy;
        ctx.setLineDash([3, 3]); ctx.lineDashOffset = -this.t * 0.5;
        ctx.strokeStyle = `rgba(217,154,82,${0.35 + pulse * 0.2})`; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(x, y); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    const mark = (kind: 'hook' | 'ledge', x: number, y: number, a: number) => {
      x = Math.round(x + ox); y = Math.round(y + oy);
      ctx.strokeStyle = `rgba(255,236,170,${a})`; ctx.fillStyle = `rgba(255,226,140,${a * 0.35})`; ctx.lineWidth = 1;
      // a ring round the target hook (open, so the hook itself still shows)
      if (kind === 'hook') { ctx.beginPath(); ctx.arc(x + 0.5, y + 4.5, 10 + pulse * 2, 0, Math.PI * 2); ctx.stroke(); return; }
      // a landing mark at her feet: a flat ring and two corner brackets
      ctx.beginPath(); ctx.ellipse(x + 0.5, y - 1.5, 9 + pulse * 2, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 10, y - 8); ctx.lineTo(x - 10, y - 2); ctx.moveTo(x + 11, y - 8); ctx.lineTo(x + 11, y - 2); ctx.stroke();
    };
    if (aim) {
      // the dotted arc, the dots drifting along it towards the target
      const n = aim.path.length - 1, drift = (this.t * 0.06) % 1;
      for (let i = 0; i < n * 2; i++) {
        const u = (i + drift) / (n * 2), k = Math.min(n - 1, Math.floor(u * n)), f = u * n - k;
        const p = aim.path[k], q = aim.path[k + 1];
        const x = p.x + (q.x - p.x) * f + ox, y = p.y + (q.y - p.y) * f - HERO_H / 2 + oy;
        ctx.fillStyle = `rgba(255,236,170,${0.35 + 0.5 * u})`;
        ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
      mark(aim.kind, aim.kind === 'hook' ? aim.hx : aim.x, aim.kind === 'hook' ? aim.hy : aim.y, 0.8);
    }
    if (b.fly && !b.fly.home) mark(b.fly.kind, b.fly.kind === 'hook' ? b.fly.hx : b.fly.x1, b.fly.kind === 'hook' ? b.fly.hy : b.fly.y1, 0.6 * (1 - b.fly.t / b.fly.dur) + 0.2);
    ctx.restore();
  }

  /** The Windward Belfry's moving world: the giant swinging bells on their ropes, the echo notes, wind streaks in the
   *  gusts, and Dora's Bell Rope from her hand to its hook. */
  drawBelfry(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx, room = g.room;
    // swinging bells: a rope from the beam, and the bell turned to its angle about the rope's end
    const p2 = this.img.get('props2'), a2 = ART.props2;
    for (const sb of g.swingBells()) {
      const px = sb.px + ox, py = sb.py + oy, bx = sb.x + ox, by = sb.y + oy;
      ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = '#a07a4a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = '#231a1e'; ctx.fillRect(Math.round(px) - 3, Math.round(py) - 2, 6, 4);
      if (p2 && a2) {
        ctx.save(); ctx.translate(Math.round(bx), Math.round(by)); ctx.rotate(-sb.ang * 0.6);
        // the headstock (the part to stand on) is the frame's top: draw the bell hanging below it
        ctx.drawImage(p2, 5 * a2[0], 0, a2[0], a2[1], -a2[0] / 2, -a2[1] + 56 - 2, a2[0], a2[1]);
        ctx.restore();
      }
    }
    // echo notes: they fade in one after another, and flicker as they run out
    for (const n of g.notes) {
      if (n.room !== room.id || n.t < n.at) continue;
      const left = n.life - n.t, a = Math.min(1, (n.t - n.at) / 8) * (left < 60 ? (Math.floor(left / 5) % 2 ? 0.35 : 0.9) : 0.9);
      const x = (n.x0 + n.x1) / 2 + ox, y = n.y + oy;
      if (p2 && a2) { ctx.globalAlpha = a; this.spr('props2', 7, x, y + 10); ctx.globalAlpha = 1; }
      else { ctx.fillStyle = `rgba(95,227,255,${a})`; ctx.fillRect(Math.round(n.x0 + ox), Math.round(y), n.x1 - n.x0, 4); }
      if (this.t % 12 === 0) this.particles.push({ x: x - ox + (Math.random() - 0.5) * 24, y: y - oy, vx: 0, vy: -0.3, life: 0, max: 24, color: '#9ff4ff', size: 1, g: 0, light: true });
    }
    // gusts: streaks blowing the way the wind goes
    const gz = room.gusts, area = room.area as 'cloud' | 'loft';
    if (gz || g.boss?.calm === false) {
      const zones: [number, number, number, number, number][] = [];
      const c0 = room.gx * COLS, r0 = room.gy * ROWS;
      for (const z of gz ?? []) if ((z as unknown[])[5] !== 'boss') zones.push([c0 + z[0], r0 + z[1], c0 + z[2], r0 + z[3], (g.save.wind[area] ?? 1) * (z[4] as number)]);
      if (g.boss && !g.boss.calm && g.arenaWind && g.windAt(g.body.x, g.body.y - 10) !== 0) {
        const rr = g.bossRoomRect(); zones.push([rr.x / TILE, rr.y / TILE, (rr.x + rr.w) / TILE, (rr.y + rr.h) / TILE, g.windAt(g.body.x, g.body.y - 10)]);
      }
      ctx.strokeStyle = 'rgba(255,248,236,0.35)'; ctx.lineWidth = 1;
      for (const [x0, y0, x1, y1, w] of zones) {
        if (!w) continue;
        const W = (x1 - x0) * TILE, H = (y1 - y0) * TILE;
        for (let k = 0; k < Math.min(40, Math.round((W * H) / 2600)); k++) {
          const h = hash(k, x0 * 7 + y0), sp = 1.5 + (h % 5) * 0.4;
          const xx = x0 * TILE + ((((h >> 3) % W) + this.t * sp * Math.sign(w) * Math.abs(w)) % W + W) % W, yy = y0 * TILE + ((h >> 9) % H);
          const L = 6 + (h % 7);
          ctx.beginPath(); ctx.moveTo(Math.round(xx + ox), Math.round(yy + oy) + 0.5); ctx.lineTo(Math.round(xx + ox - Math.sign(w) * L), Math.round(yy + oy) + 0.5); ctx.stroke();
        }
      }
    }
    // the Bell Rope, from Dora's raised hand to the hook
    const b = g.body;
    if (b.rope && g.lead === 'dora') {
      const hx = b.x + ox + b.face * 2, hy = b.y - HERO_H - 6 + oy;
      ctx.strokeStyle = '#3a2414'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(b.rope.hx + ox, b.rope.hy + oy); ctx.stroke();
      ctx.strokeStyle = '#d99a52'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(b.rope.hx + ox, b.rope.hy + oy); ctx.stroke();
    }
  }

  drawPickups(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx;
    for (const p of g.pickups) {
      const x = Math.round(p.x + ox), y = Math.round(p.y + oy);
      if (p.kind === 'coin') {
        const w = [3, 2, 1, 2][Math.floor((this.t + p.id * 5) / 6) % 4];
        ctx.fillStyle = '#7a4a10'; ctx.fillRect(x - w, y - 3, w * 2 + 1, 7);
        ctx.fillStyle = '#ffd040'; ctx.fillRect(x - w + 1, y - 2, Math.max(1, w * 2 - 1), 5);
        ctx.fillStyle = '#fff6c0'; ctx.fillRect(x, y - 2, 1, 2);
      } else if (p.kind === 'bag') this.spr('npcs', 6, x, y + 6 + Math.sin(this.t * 0.08) * 1.5);
      else {
        // a little gem that bobs and turns
        const by = y + Math.round(Math.sin((this.t + p.id * 9) * 0.1) * 1.5), w = [2, 1, 0, 1][Math.floor((this.t + p.id * 3) / 8) % 4];
        ctx.fillStyle = p.kind === 'mp' ? '#2a5aa8' : '#a82a3a'; ctx.fillRect(x - w - 1, by - 3, w * 2 + 3, 7);
        ctx.fillStyle = p.kind === 'mp' ? '#4fa8ff' : '#ff5a6a'; ctx.fillRect(x - w, by - 2, w * 2 + 1, 5);
        ctx.fillStyle = '#fff'; ctx.fillRect(x, by - 2, 1, 1);
      }
    }
  }

  drawEnemies(g: BellspireGame, ox: number, oy: number) {
    for (const e of g.enemies) {
      if (!e.alive || e.hidden) continue;
      // the frame comes from the game clock, the same one its hitbox is measured from
      const frame = foeFrame(e, g.tick);
      // every foe is drawn from (x, y + 1), the same point its hitboxes are measured from
      let x = e.x + ox;
      const y = e.y + oy + 1;
      // a tell shivers, so the warning is easy to see
      if (e.st === 'tell') x += (this.t % 4 < 2 ? 1 : -1);
      // a clapper hangs on its rope from the tie above its spot (the art is the body only, ring at the top)
      if (e.kind === 'clapper') {
        const ctx = this.ctx, ax = e.hx + ox, ay = e.hy - 34 + oy, tx = e.x + ox, ty = e.y + oy + 1 - 28;
        ctx.strokeStyle = '#2a1c14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = '#b08850'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = '#231a1e'; ctx.fillRect(Math.round(ax) - 2, Math.round(ay) - 2, 4, 3);
      }
      // hurt: a white flash and a squash that springs back
      const hurt = e.flash > 4;
      if (hurt) {
        const ctx = this.ctx;
        ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(1.12, 0.88);
        this.spr('foes', frame, 0, 0, e.face > 0, 1, e.flash % 4 < 2);
        ctx.restore();
      } else this.spr('foes', frame, x, y, e.face > 0, 1, e.flash > 0 && e.flash % 4 < 2);
      const top = g.foeRect(e).y + oy;
      if (e.st === 'tell') this.text('!', x, top - 6, '#ffe27a');
      if (e.kind === 'frog' && e.st === 'sleep' && this.t % 90 < 60) this.text('', x, top - 4, '#fff');
    }
    void ROOMS;
  }

  /** The snapshot the animator reads for the lead: straight from the body and the hero's action. */
  leadInput(g: BellspireGame): AnimInput {
    const lead = g.lead, b = g.body, rt = g.hero[lead], act = rt.act, sw = SWING[lead];
    const ev = this.animEvents[lead]; this.animEvents[lead] = [];
    if (b.jumped) ev.push('jumped');
    if (b.jumped === 'wall') ev.push('kicked');
    if (b.hooked) ev.push('hooked');
    if (b.unhooked) ev.push('unhooked');
    return {
      ground: b.ground, vx: b.vx, vy: b.vy, face: b.face, climb: b.climb, swim: b.swim, wade: b.wade, glide: b.glide,
      wallSlide: b.wall !== 0 && !b.ground && b.vy > 0 && g.has('wallkick'), dash: b.dashT > 0, hurt: rt.hurtT > 0, down: false,
      act: act ? { kind: act.kind, n: act.n, t: act.t, wind: sw.wind, active: sw.act, spell: act.spell } : null,
      castHold: rt.castHold > 6, lanternUp: lead === 'enzo' && g.lanternUp, events: ev,
      // the Windward Belfry: the rope's angle as seen from the way the hero faces, the gust, the float underfoot, hail
      rope: b.rope ? { ang: b.rope.ang * b.face, av: b.rope.av * b.face } : null, fly: !!b.fly,
      gust: b.ground && Math.abs(b.vx) < 0.3 ? b.gust : 0, ride: g.riding,
      hail: g.shots.some((s) => !s.friendly && (s.kind === 'hail' || s.kind === 'ice') && Math.abs(s.x - b.x) < 60 && s.y < b.y && b.y - s.y < 120),
      castLong: rt.castHold >= 40 && g.save.spells.includes('gale'),
    };
  }

  /** The follower has no body of its own (it walks the lead's trail), so its motion is read from how it moved. */
  followerInput(g: BellspireGame, hero: HeroId): AnimInput {
    const f = g.follower, vx = f.x - this.followerWas.x, vy = f.y - this.followerWas.y;
    this.followerWas = { x: f.x, y: f.y };
    const ev = this.animEvents[hero]; this.animEvents[hero] = [];
    // the follower climbs where the lead climbed (the trail records it), and its own movement turns the climb cycle
    const onLadder = f.climb;
    return {
      ground: !f.air || onLadder, vx: f.moving && !onLadder ? vx : 0, vy, face: f.face, climb: onLadder, swim: f.swim, wade: false, glide: false,
      wallSlide: false, dash: false, hurt: false, down: false,
      act: f.swipeT > 0 && hero === 'dora' ? { kind: 'swing', n: 0, t: 10 - f.swipeT, wind: 2, active: 4 } : null,
      castHold: false, lanternUp: hero === 'enzo' && g.lanternUp, events: ev,
    };
  }

  /** One hero sprite with the animator's squash, stretch and lean, about the feet. */
  drawHero(hero: HeroId, out: AnimOut, x: number, y: number, alpha: number, white = false) {
    const ctx = this.ctx;
    let flip = out.flip;
    // back views don't turn round
    if (out.state === 'climb' || out.state === 'climbOn' || out.state === 'read') flip = false;
    const w = this.worn[hero], name = this.dressed(hero, w.weapon, w.coat);
    if (COAT_LOOK[w.coat]?.shell && !white) this.shellAfter = { name, frame: out.frame, x, y, flip, alpha };
    if (out.sx === 1 && out.sy === 1 && Math.abs(out.lean) < 0.01) { this.spr(name, out.frame, x, y, flip, alpha, white); this.drawShell(); return; }
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    // x' = sx·x − lean·y: with y up-negative, the top of the sprite leans the way `lean` says
    ctx.transform(out.sx, 0, -out.lean, out.sy, 0, 0);
    this.spr(name, out.frame, 0, 0, flip, alpha, white);
    ctx.restore();
    this.drawShell();
  }

  shellAfter: { name: string; frame: number; x: number; y: number; flip: boolean; alpha: number } | null = null;
  /** The Snail-Shell Coat's little spiral shell, on the coat's back (it turns with the hero). */
  drawShell() {
    const s = this.shellAfter;
    this.shellAfter = null;
    if (!s) return;
    const bx = this.coatBoxes.get(s.name)?.[s.frame], a = ART[s.name.split('@')[0]];
    if (!bx || !a) return;
    const [cw, ch] = a, left = Math.round(s.x - cw / 2), top = Math.round(s.y - ch);
    const cx0 = bx.x0 - s.frame * cw, cx1 = bx.x1 - s.frame * cw;
    // the art faces right, so its back is the coat's left edge; mirrored when the hero faces left
    const bxl = s.flip ? cw - 1 - cx0 - 4 : cx0 - 1, by = Math.round((bx.y0 + bx.y1) / 2) - 3;
    void cx1;
    const ctx = this.ctx, X = left + bxl, Y = top + by;
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = '#221820'; ctx.fillRect(X, Y, 6, 6);
    ctx.fillStyle = '#c99a62'; ctx.fillRect(X + 1, Y + 1, 4, 4);
    ctx.fillStyle = '#6a4424'; ctx.fillRect(X + 2, Y + 2, 2, 1); ctx.fillRect(X + 3, Y + 2, 1, 2); ctx.fillRect(X + 2, Y + 3, 1, 1);
    ctx.fillStyle = '#f0d8a8'; ctx.fillRect(X + 1, Y + 1, 1, 1);
    ctx.globalAlpha = 1;
  }

  /** Rings and relics, small but there: a glint, a sparkle, a feather, a bell. */
  trinkets(g: BellspireGame, hero: HeroId, out: AnimOut, x: number, y: number, alpha: number) {
    const eq = g.save.equip[hero], f = out.flip ? -1 : 1, ctx = this.ctx, t = this.t + (hero === 'enzo' ? 37 : 0);
    const box = BOXES[hero]?.[out.frame];
    const top = box ? y + box[1] : y - 36;
    const hand = { x: x + f * 6, y: y - 15 };
    ctx.globalAlpha = alpha;
    if (eq.ring === 'frog-ring' && t % 110 < 8) { ctx.fillStyle = '#ffe680'; ctx.fillRect(Math.round(hand.x), Math.round(hand.y), 1, 1); if (t % 110 < 3) { ctx.fillRect(Math.round(hand.x) - 1, Math.round(hand.y), 3, 1); ctx.fillRect(Math.round(hand.x), Math.round(hand.y) - 1, 1, 3); } }
    if (eq.ring === 'moon-ring' && t % 150 === 0) this.particles.push({ x: hand.x - this.ox, y: hand.y - this.oy, vx: 0, vy: -0.25, life: 0, max: 40, color: '#a8c8ff', size: 1, g: -0.005, light: true });
    if (eq.ring === 'reed-ring' && t % 130 < 6) { ctx.fillStyle = '#a6f07a'; ctx.fillRect(Math.round(hand.x), Math.round(hand.y), 1, 1); }
    if (eq.relic === 'condor-feather' && out.state !== 'climb' && out.state !== 'read' && out.state !== 'ko') {
      // tucked behind an ear: a long dark feather leaning back
      const fx = Math.round(x - f * 5), fy = Math.round(top + 4);
      ctx.fillStyle = '#221820'; for (let k = 0; k < 6; k++) ctx.fillRect(fx - f * Math.floor(k / 2), fy - k, 2, 1);
      ctx.fillStyle = '#f2f0ea'; ctx.fillRect(fx - f * 2, fy - 5, 1, 1);
    }
    if (eq.relic === 'bell-charm') {
      // a tiny bell at the belt, which swings and jingles when the hero lands
      if (out.dust === 'land' || out.dust === 'hard') { this.bellSwingT[hero] = 24; this.burst(x - this.ox - f * 4, y - this.oy - 11, 3, '#ffe27a', 0.8, -0.4); }
      const sw = this.bellSwingT[hero] > 0 ? Math.round(Math.sin(this.bellSwingT[hero]-- * 0.8) * 1.5) : 0;
      const bxp = Math.round(x - f * 4 + sw), byp = Math.round(y - 12);
      ctx.fillStyle = '#221820'; ctx.fillRect(bxp - 1, byp - 1, 4, 4);
      ctx.fillStyle = '#e8b83a'; ctx.fillRect(bxp, byp, 2, 2);
      ctx.fillStyle = '#fff2a8'; ctx.fillRect(bxp, byp, 1, 1);
    }
    if (this.shineT[hero] > 0) {
      // just changed gear: a ring of glints turning round the hero
      const k = this.shineT[hero]--;
      for (let j = 0; j < 4; j++) { const a2 = k * 0.25 + (j * Math.PI) / 2; ctx.fillStyle = j % 2 ? '#fff6c8' : '#ffffff'; ctx.fillRect(Math.round(x + Math.cos(a2) * 13), Math.round(y - 18 + Math.sin(a2) * 15), 2, 2); }
    }
    ctx.globalAlpha = 1;
  }

  drawHeroes(g: BellspireGame, ox: number, oy: number) {
    for (const h of ['dora', 'enzo'] as HeroId[]) { const e = g.save.equip[h]; this.worn[h] = { weapon: e.weapon ?? START_LOOK[h].weapon, coat: e.coat ?? START_LOOK[h].coat }; }
    this.ox = ox; this.oy = oy;
    const lead = g.lead, oth: HeroId = lead === 'dora' ? 'enzo' : 'dora', b = g.body;
    this.leadNow = lead;
    // a tag: the hero who just stepped back hops out of the way
    if (this.pendingTag) { this.animEvents[oth].push('tagOut'); this.pendingTag = false; }
    // knocked out: the fallen hero slumps where they fell and fades
    if (this.pendingDown) { this.koMarks.push({ hero: this.pendingDown, x: b.x, y: b.y, t: 0, flip: b.face < 0 }); this.pendingDown = null; }
    for (const h of [lead, oth]) { const d = g.save.heroes[h].down; if (this.wasDown[h] && !d) this.animEvents[h].push('revive'); this.wasDown[h] = d; }
    for (const k of this.koMarks) {
      k.t++;
      const out: AnimOut = { state: 'ko', frame: 50, flip: k.flip, sx: 1, sy: 1, lean: 0, trail: false, dust: '' };
      this.drawHero(k.hero, out, k.x + ox, k.y + oy + 1, Math.max(0, 1 - k.t / 90) * 0.85);
    }
    this.koMarks = this.koMarks.filter((k) => k.t < 90);
    // the follower first, behind
    if (!g.save.heroes[oth].down && this.travelFx < 0) {
      const out = this.anims[oth].step(this.followerInput(g, oth));
      this.heroAnim[oth] = out;
      this.drawHero(oth, out, g.follower.x + ox, g.follower.y + oy + 1, 0.92);
      this.trinkets(g, oth, out, g.follower.x + ox, g.follower.y + oy + 1, 0.92);
      this.dust(out, g.follower.x, g.follower.y);
    }
    const out = this.anims[lead].step(this.leadInput(g));
    this.heroAnim[lead] = out;
    // a journey: both kneel; candlelight swirls up round them as they fade; at the far shrine the flame flares
    if (this.travelFx >= 0) {
      const tf = this.travelFx, first = tf !== this.travelSeen;
      this.travelSeen = tf;
      if (first && tf < 30 && tf % 2 === 0) for (let i = 0; i < 3; i++) {
        const a = (tf * 0.5 + i * 2.1), r = 10 + Math.random() * 8;
        this.particles.push({ x: b.x + Math.cos(a) * r, y: b.y - 4 - Math.random() * 10, vx: -Math.sin(a) * 0.8, vy: -0.7 - Math.random() * 0.6, life: 0, max: 30, color: i % 2 ? '#ffd27a' : '#ffb04a', size: 2, g: -0.01, light: true });
      }
      if (first && tf === 31) {
        const sp = g.shrineSpot(g.room.id);
        if (sp) { this.pulses.push({ x: sp.x - 18, y: sp.y - 20, r: 120, c: [1, 0.8, 0.45], t: 0 }); this.burst(sp.x - 18, sp.y - 24, 16, '#ffd27a', 2, -1); }
      }
      const a = tf < 30 ? 1 - tf / 30 : (tf - 30) / 30;
      const kneel = (h: HeroId): AnimOut => ({ state: 'rest', frame: tf < 45 ? 36 : 0, flip: h === lead ? b.face < 0 : g.follower.face < 0, sx: 1, sy: 1, lean: 0, trail: false, dust: '' });
      if (!g.save.heroes[oth].down) this.drawHero(oth, kneel(oth), g.follower.x + ox, g.follower.y + oy + 1, a * 0.92);
      this.drawHero(lead, kneel(lead), b.x + ox, b.y + oy + 1, a);
      return;
    }
    this.travelSeen = -1;
    // a wall slide faces the wall; the kick springs away from it
    if (out.state === 'wallSlide') out.flip = b.wall < 0;
    else if (out.state === 'wallKick') out.flip = b.vx > 0;
    // the dash: fading copies left behind
    if (out.trail && this.t % 2 === 0) this.ghosts.push({ hero: lead, frame: out.frame, x: b.x, y: b.y, flip: out.flip, t: 0 });
    for (const gh of this.ghosts) { gh.t++; this.spr(gh.hero, gh.frame, gh.x + ox, gh.y + oy + 1, gh.flip, 0.35 * (1 - gh.t / 12), true); }
    this.ghosts = this.ghosts.filter((gh) => gh.t < 12);
    const rt = g.hero[lead];
    const blink = rt.inv > 0 && rt.hurtT === 0 && rt.inv < 60 && this.t % 6 < 3;
    this.drawHero(lead, out, b.x + ox, b.y + oy + 1, blink ? 0.35 : 1);
    this.trinkets(g, lead, out, b.x + ox, b.y + oy + 1, blink ? 0.35 : 1);
    this.dust(out, b.x, b.y);
    // the swing's arc
    const box = g.attackBox(), act = g.leadRt.act;
    if (box && act && act.kind === 'swing') {
      const ctx = this.ctx, b = g.body;
      // the arc is drawn from the hit box itself: centred on the hero's side of the box, reaching its far edge, and
      // spanning its height, so what you see cut is what is hit
      const r = box.r.w, cxh = b.x + ox, cyh = box.r.y + box.r.h / 2 + oy, span = Math.asin(Math.min(0.97, box.r.h / 2 / r));
      ctx.strokeStyle = WEAPON_LOOK[this.worn[lead].weapon]?.arc ?? 'rgba(220,250,255,0.9)'; ctx.lineWidth = act.n === 2 ? 3 : 2;
      ctx.beginPath();
      // the first and last cuts come down, the second goes up: the bright end leads
      if (b.face > 0) ctx.arc(cxh, cyh, r, -span, span); else ctx.arc(cxh, cyh, r, Math.PI - span, Math.PI + span);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.beginPath();
      if (b.face > 0) ctx.arc(cxh, cyh, r - 4, -span * 0.8, span * 0.8); else ctx.arc(cxh, cyh, r - 4, Math.PI - span * 0.8, Math.PI + span * 0.8);
      ctx.stroke();
    }
    if (act && act.kind === 'whirl') { const ctx = this.ctx; ctx.strokeStyle = WEAPON_LOOK[this.worn.dora.weapon]?.arc ?? 'rgba(200,250,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.body.x + ox, g.body.y - 12 + oy, 26, act.t * 0.5, act.t * 0.5 + 4); ctx.stroke(); }
    if (g.embers) {
      const c = g.lead === 'enzo' ? { x: g.body.x, y: g.body.y - 12 } : { x: g.follower.x, y: g.follower.y - 12 };
      for (let i = 0; i < 8; i++) { const a = g.embers.t * 0.12 + (i * Math.PI) / 4; this.spr('foes', 23, c.x + Math.cos(a) * 34 + ox, c.y + Math.sin(a) * 34 + oy + 24); }
    }
  }

  /** An Echo Trial run's bells in this room: the next one bright and swaying, with its number, the later ones dim. */
  drawTrialBells(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx, t = g.trial!;
    t.def.goals.forEach((goal, i) => {
      if (i < t.i || goal.room !== g.room.id) return;
      const p = g.trialBellAt(goal), next = i === t.i;
      const x = Math.round(p.x + ox), y = Math.round(p.y + oy);
      ctx.globalAlpha = next ? 1 : 0.45;
      // a little post with an arm, and a bell on it that swings
      ctx.fillStyle = '#2a2030'; ctx.fillRect(x - 9, y - 34, 3, 34); ctx.fillRect(x - 9, y - 34, 10, 2);
      ctx.fillStyle = '#6a5a70'; ctx.fillRect(x - 8, y - 33, 1, 32);
      const sw = next ? Math.sin(this.t * 0.12) * 0.35 : 0;
      ctx.save(); ctx.translate(x, y - 32); ctx.rotate(sw);
      ctx.fillStyle = next ? '#bfe8ff' : '#7a90a0'; ctx.beginPath(); ctx.moveTo(-5, 10); ctx.quadraticCurveTo(-5, 1, 0, 1); ctx.quadraticCurveTo(5, 1, 5, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = next ? '#ffffff' : '#a0b0c0'; ctx.fillRect(-6, 9, 12, 2); ctx.fillRect(-1, 11, 2, 2);
      ctx.restore();
      ctx.globalAlpha = 1;
      if (next) this.text(String(i + 1), x, y - 40, '#dff4ff');
      if (next && this.t % 10 === 0) this.particles.push({ x: p.x + (Math.random() - 0.5) * 10, y: p.y - 26, vx: 0, vy: -0.4, life: 0, max: 30, color: '#bfe8ff', size: 1, g: 0, light: true });
    });
  }
  /** Warnings that must show over the heroes and the water: the frog's shadow as it comes down (with dust falling
   *  from the dark above it), and the whirlpools where the Lake Mother's spouts will rise. */
  drawWarnings(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx;
    for (const m of g.markers) {
      const cx = Math.round(m.x + ox), cy = Math.round(m.y + oy);
      if (m.kind === 'shadow') {
        const k = 1 - Math.max(0, m.t) / 64;
        this.shadow(cx, cy, Math.max(12, 14 + 26 * k), 0.35 + 0.3 * k);
        ctx.strokeStyle = `rgba(255,120,90,${0.5 + 0.4 * (this.t % 10 < 5 ? 1 : 0)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, cy - 1, Math.max(12, 14 + 26 * k) + 2, Math.max(3, (14 + 26 * k) * 0.22), 0, 0, Math.PI * 2); ctx.stroke();
        if (this.t % 2 === 0) this.particles.push({ x: m.x + (Math.random() - 0.5) * 20, y: g.bossRoomRect().y + 8, vx: 0, vy: 2.5, life: 0, max: 60, color: '#b8b0a0', size: 1, g: 0.05 });
      } else if (m.kind === 'bell' || m.kind === 'lily') {
        // where a bell or a lily will land: a pulsing ring on the floor, a faint column of light up to it, and a small
        // picture of what is coming, so the spot reads even under the heroes or the water
        const bell = m.kind === 'bell', k = this.t % 12 < 6, w = 13 + (k ? 1 : 0);
        const col = bell ? '255,208,96' : '170,255,210';
        const top = g.bossRoomRect().y + 40, gr = ctx.createLinearGradient(0, top + oy, 0, cy);
        gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(1, `rgba(${col},0.22)`);
        ctx.fillStyle = gr; ctx.fillRect(cx - 9, Math.round(top + oy), 18, Math.round(cy - top - oy));
        ctx.fillStyle = `rgba(${col},0.25)`; ctx.beginPath(); ctx.ellipse(cx, cy - 1, w, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(${col},${k ? 1 : 0.7})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy - 1, w, 4, 0, 0, Math.PI * 2); ctx.stroke();
        if (bell) { ctx.fillStyle = k ? '#ffd060' : '#c89030'; ctx.fillRect(cx - 3, cy - 14, 6, 6); ctx.fillRect(cx - 4, cy - 9, 8, 2); ctx.fillRect(cx - 1, cy - 16, 2, 2); ctx.fillRect(cx - 1, cy - 7, 2, 2); }
        else { this.lily(cx, cy - 10, 0.5, 0); }
      } else if (m.kind === 'swirl') {
        for (let i = 0; i < 3; i++) { ctx.strokeStyle = i ? 'rgba(120,210,230,0.85)' : '#e0ffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy - 2, 6 + i * 5, 2 + i * 1.2, 0, this.t * 0.2 + i * 2, this.t * 0.2 + i * 2 + 4); ctx.stroke(); }
      }
    }
  }
  /** A falling lily pad: a round green pad with its notch and veins, and a white water lily on it. */
  lily(x: number, y: number, scale: number, rot: number) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot); ctx.scale(scale, scale);
    ctx.fillStyle = '#1e4a30'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, 0, 0.35, Math.PI * 2 - 0.35); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3e8a52'; ctx.beginPath(); ctx.ellipse(0, -1, 11, 6, 0, 0.4, Math.PI * 2 - 0.4); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6cc07a'; ctx.lineWidth = 1; ctx.beginPath(); for (const a of [2.2, 3.1, 4.0]) { ctx.moveTo(0, -1); ctx.lineTo(Math.cos(a) * 9, -1 + Math.sin(a) * 5); } ctx.stroke();
    ctx.fillStyle = '#f4fff6'; for (const [px, py] of [[-4, -4], [0, -6], [4, -4], [-2, -3], [2, -3]]) ctx.fillRect(px - 1, py - 1, 3, 3);
    ctx.fillStyle = '#ffe27a'; ctx.fillRect(-1, -5, 2, 2);
    ctx.restore();
  }
  /** A soft dark oval on the floor (a shadow from above). */
  shadow(x: number, y: number, r: number, a: number) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(8,6,16,${a})`; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y - 1), r, Math.max(2, r * 0.2), 0, 0, Math.PI * 2); ctx.fill();
  }
  drawBoss(g: BellspireGame, b: Boss, ox: number, oy: number) {
    const ctx = this.ctx;
    const tell = b.tellT > 0 && Math.floor(b.tellT / 3) % 2 === 0;
    const white = b.flash > 0 && b.flash % 4 < 2;
    const calmA = b.calm ? Math.max(0.25, 1 - b.t / 120) : 1;
    const st = b.st;
    const atk = /hop|tongue|pounce|dash|leap|swing|drop|sweep|twin|flopUp|flopDown|chorus|spout/.test(st) && !st.endsWith('Tell');
    // frames: 0 rest, 1 and 3 the wind-up (they alternate, so a tell throbs), 2 the attack, 4 staggered by a hit, 5 calmed
    const fr = b.calm ? 5 : st.endsWith('Tell') ? (Math.floor(this.t / 7) % 2 ? 3 : 1) : atk ? 2 : b.flash > 3 ? 4 : 0;
    const body = b.body;
    const fx: SprFx = { rim: b.calm ? undefined : RIM[b.id], tell: tell && !b.calm };
    if (b.id === 'frog') {
      // New Game+'s belly flop: a deep squat that throbs, stretched tall in the leap and the fall, flattened on landing
      let sx = 1, sy = 1;
      if (st === 'flopTell') { const k = Math.min(1, b.t / 18); sx = 1 + 0.18 * k; sy = 1 - 0.26 * k + (this.t % 6 < 3 ? 0.03 : 0); }
      else if (st === 'flopUp' || st === 'flopDown') { sx = 0.84; sy = 1.24; }
      else if (st === 'flopLand') { const k = Math.max(0, 1 - b.t / 22); sx = 1 + 0.32 * k; sy = 1 - 0.3 * k; }
      if (st === 'flopDown') this.shadow(b.x + ox, g.floorY() + oy, 30 + 8 * Math.min(1, b.t / 14), 0.55);
      if (st !== 'flopAim') this.sprXf('boss-frog', st === 'flopLand' && b.t < 30 ? 4 : fr, b.x + ox, b.y + oy + 2, b.face > 0, calmA, white, fx, sx, sy);
      if (st === 'tongue') { for (const h of b.harm) { ctx.fillStyle = '#d0506a'; ctx.fillRect(Math.round(h.x + ox), Math.round(h.y + oy + 2), Math.round(h.w), 5); ctx.fillStyle = '#ff8aa0'; ctx.fillRect(Math.round(h.x + ox), Math.round(h.y + oy + 2), Math.round(h.w), 1); } }
    } else if (b.id === 'puma') {
      // New Game+'s painted twin: the puma rears (tilted back on its haunches) while a copy of it, all wet paint, comes
      // off the far wall; then the copy charges with a smear of paint behind it
      const tw = (st === 'twinTell' || st === 'twin') ? b.arms[0] : undefined;
      if (tw) {
        const a = st === 'twinTell' ? Math.min(1, b.t / 40) * 0.75 : 0.75, tf = b.face < 0;
        const k = st === 'twin' && b.t > 22;
        if (k) for (let i = 1; i <= 4; i++) { ctx.globalAlpha = 0.18 * (5 - i) / 4; ctx.fillStyle = '#c050d0'; ctx.fillRect(Math.round(tw.x + ox - (tf ? 1 : -1) * i * 9 - 10), Math.round(tw.y + oy - 18 + i), 20, 10 - i * 2); }
        ctx.globalAlpha = 1;
        this.spr('boss-puma', k ? 2 : st === 'twinTell' ? 1 : 0, tw.x + ox, tw.y + oy + 2, tf, a, false, { wash: '#b048c8', tell: st === 'twinTell' && this.t % 6 < 3 });
        if (!k && this.t % 4 === 0) this.particles.push({ x: tw.x + (Math.random() - 0.5) * 30, y: tw.y - 24 + Math.random() * 10, vx: 0, vy: 0.5, life: 0, max: 24, color: '#d070e0', size: 2, g: 0.04 });
      }
      this.sprXf('boss-puma', fr, b.x + ox, b.y + oy + 2, b.face > 0, calmA * b.vis, white, fx, 1, st === 'twinTell' ? 1.08 : 1, st === 'twinTell' ? -b.face * 0.22 * Math.min(1, b.t / 12) : 0);
    } else if (b.id === 'mother') {
      // New Game+'s spouts: she rises up out of the water, arms high, and sinks back as the columns burst
      const lift = st === 'spoutTell' ? Math.min(1, b.t / 24) * 14 + (this.t % 8 < 4 ? 1 : 0) : st === 'spout' ? Math.max(0, 14 - b.t * 0.4) : 0;
      this.sprXf('boss-mother', fr, b.x + 40 + ox, b.y + oy + 2 - lift, false, calmA, white, fx, 1, 1 + lift / 140);
      if (st === 'spout') b.arms.forEach((a, i) => {
        const u = b.t - i * 18;
        if (u < 0 || u >= 34) return;
        const top = g.bossRoomRect().y + 30, h = (g.floorY() - top) * Math.min(1, u / 6) * (u > 28 ? (34 - u) / 6 : 1);
        const x0 = Math.round(a.x - 13 + ox), y1 = Math.round(g.floorY() + oy);
        ctx.fillStyle = 'rgba(60,150,190,0.85)'; ctx.fillRect(x0, y1 - h, 26, h);
        ctx.fillStyle = 'rgba(150,230,245,0.9)'; ctx.fillRect(x0 + 4, y1 - h, 4, h); ctx.fillRect(x0 + 16, y1 - h, 2, h);
        for (let k = 0; k < h; k += 12) { const w = ((k + this.t * 3) % 24) < 12 ? 1 : -1; ctx.fillStyle = '#e8ffff'; ctx.fillRect(x0 + 12 + w * 8, y1 - h + k, 2, 4); }
        ctx.fillStyle = '#f0ffff'; ctx.fillRect(x0 - 3, Math.round(y1 - h), 32, 3);
        if (this.t % 2 === 0) this.particles.push({ x: a.x + (Math.random() - 0.5) * 26, y: g.floorY() - h, vx: (Math.random() - 0.5) * 2, vy: -1.4 - Math.random(), life: 0, max: 22, color: '#bff4ff', size: 2, g: 0.12 });
      });
      if (st === 'sweep' && b.arms[0]) {
        // a rolling wave: a curved crest, higher at the front, with a foam lip and spray
        const a = b.arms[0], x0 = Math.round(a.x - 18 + ox), y0 = Math.round(a.y + oy), dir = g.body.x < a.x ? -1 : 1;
        for (let i = 0; i < 36; i++) {
          const f = dir > 0 ? i / 35 : 1 - i / 35, h = Math.round(5 + 11 * Math.sin(f * Math.PI * 0.85));
          ctx.fillStyle = 'rgba(70,170,190,0.9)'; ctx.fillRect(x0 + i, y0 - h, 1, h);
          ctx.fillStyle = 'rgba(150,235,240,0.95)'; ctx.fillRect(x0 + i, y0 - h, 1, Math.min(3, h));
          if ((i + this.t) % 5 === 0) { ctx.fillStyle = '#f0ffff'; ctx.fillRect(x0 + i, y0 - h - 1 - ((i * 7 + this.t) % 3), 1, 1); }
        }
      }
    } else if (b.id === 'hydra') {
      // necks: thick reed ropes from the coiled body to each head
      const baseX = b.x + ox, baseY = b.y - 70 + oy;
      for (const h of b.heads) {
        const hx = h.x + ox, hy = h.y + oy;
        for (const [w, c] of [[9, '#2a2a14'], [7, '#6a7a2a'], [3, '#a8a050']] as const) {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(baseX, baseY);
          ctx.quadraticCurveTo((baseX + hx) / 2 + 20, Math.min(baseY, hy) - 10, hx + 10, hy + 6); ctx.stroke();
        }
      }
      this.spr('boss-hydra', 0, b.x + ox + 20, b.y + oy + 8, false, calmA, white, { rim: fx.rim });
      for (const h of b.heads) {
        const rear = (st === 'rainTell' || st === 'rain') && h.st === 'idle';
        const open = h.st === 'aim' || h.st === 'lunge' || h.st === 'hold' || rear;
        // New Game+'s seed rain: the reared heads spit seeds high into the air
        if (rear && st === 'rain' && this.t % 3 === 0) this.particles.push({ x: h.x + (Math.random() - 0.5) * 8, y: h.y - 8, vx: (Math.random() - 0.5) * 1.6, vy: -3.2 - Math.random() * 1.5, life: 0, max: 26, color: '#a8d050', size: 2, g: 0.05 });
        const shiver = h.st === 'aim' && this.t % 4 < 2 ? 1 : 0;
        // heads: 0-1 swaying, 2 jaws open, 3 struck, 4 asleep, 5 snapping
        const hf = b.calm ? 4 : h.st === 'lunge' ? 5 : open ? 2 : b.flash > 3 ? 3 : Math.floor((this.t + h.x) / 24) % 2;
        this.sprXf('hydra-head', hf, h.x + ox + shiver + (rear && this.t % 4 < 2 ? 1 : 0), h.y + oy + 20, false, calmA, white, { rim: fx.rim, tell: (h.st === 'aim' || (rear && st === 'rainTell')) && this.t % 6 < 3 && !b.calm }, 1, 1, rear ? -0.35 : 0);
      }
    } else if (b.id === 'warden') {
      // (in the chorus the hand bells fly over the heroes, often in front of the big bell, so they're drawn after it)
      const chorus = st === 'chorusTell' || st === 'chorus';
      const wf = b.calm ? 4 : st === 'swing' || st === 'swing2' ? 2 : st === 'rest' || st === 'drop' || st === 'chorus' || st.endsWith('Tell') ? 1 : b.flash > 3 ? 3 : 0;
      if (chorus) this.spr('boss-warden', wf, b.x + ox, body.y + body.h + oy + 6, false, calmA, white, fx);
      for (const a of b.arms) {
        const sx = a.x < b.x ? body.x + 14 : body.x + body.w - 14, sy = body.y + 30;
        ctx.strokeStyle = '#2a2024'; ctx.lineWidth = 3; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(sx + ox, sy + oy); ctx.lineTo(a.x + ox, a.y + oy - 8); ctx.stroke(); ctx.setLineDash([]);
        // New Game+'s chorus: the hand bells ring in the air (a quick shake and a halo) before they come down
        const ring = chorus && a.y < g.floorY() - 40;
        if (ring) { ctx.strokeStyle = `rgba(255,220,140,${0.4 + 0.3 * Math.sin(this.t * 0.4)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Math.round(a.x + ox), Math.round(a.y + oy), 16 + (this.t % 12), 0, Math.PI * 2); ctx.stroke(); }
        this.sprXf('warden-bell', 0, a.x + ox, a.y + oy + 12, false, calmA, false, { rim: fx.rim, tell: fx.tell || (ring && this.t % 6 < 3) }, 1, 1, ring ? Math.sin(this.t * 0.6) * 0.3 : 0);
      }
      // the bell: 0 hanging, 1 blazing, 2 tilted in a swing, 3 jolted by a hit, 4 quiet
      if (!chorus) this.spr('boss-warden', wf, b.x + ox, body.y + body.h + oy + 6, false, calmA, white, fx);
    }
    else if (b.id === 'condor') {
      // the Hail Condor: drawn standing on (or diving at) the bottom of its body, facing the heroes
      this.spr('boss-condor', fr, b.x + ox, b.y + 30 + oy, b.face > 0, calmA, white, fx);
    } else if (b.id === 'clappers' || b.id === 'tune') {
      // the clappers and the Out-of-Tune Bell hang from ropes: the rope from the beam, the body turned to its angle
      const names = b.id === 'tune' ? ['boss-bell'] : ['boss-clapper-a', 'boss-clapper-b'];
      b.heads.forEach((h, i) => {
        const name = names[i], a = ART[name];
        if (!a) return;
        const quiet = b.calm || h.st === 'calm';
        const hst = b.id === 'tune' ? st : h.st;
        const hfr = quiet ? 5 : hst.endsWith('Tell') ? (Math.floor(this.t / 7) % 2 ? 3 : 1) : /swing|slam|clap|toll|sour|crack/.test(hst) ? 2 : b.flash > 3 ? 4 : 0;
        const bodyH = b.id === 'tune' ? 74 : 48;
        const topX = h.x + ox, topY = h.y - bodyH / 2 + (b.id === 'tune' ? -4 : 0) + oy;
        for (const [w, c] of [[3, '#2a1c14'], [1, '#b08850']] as const) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(h.bx + ox, h.by + oy); ctx.lineTo(topX, topY); ctx.stroke(); }
        ctx.fillStyle = '#231a1e'; ctx.fillRect(Math.round(h.bx + ox) - 4, Math.round(h.by + oy) - 3, 8, 4);
        ctx.save(); ctx.translate(Math.round(topX), Math.round(topY)); ctx.rotate(-(h.ang ?? 0));
        const vis = b.id === 'tune' ? b.vis : 1;
        this.spr(name, hfr, 0, b.id === 'tune' ? bodyH + 6 : 64, false, (quiet && !b.calm ? 0.8 : calmA) * vis, white && !quiet, quiet ? undefined : { rim: fx.rim, tell: hst.endsWith('Tell') && Math.floor(this.t / 3) % 2 === 0 });
        ctx.restore();
      });
    }
    if (tell && !b.calm) this.text('!', body.x + body.w / 2 + ox, body.y - 10 + oy, '#ffe27a');
    // floor markers for falling bells and lilies
    for (const m of g.markers) {
      const k = m.t % 10 < 5;
      // the frog's shadow grows as it comes down; a whirlpool turns where a spout will rise; a seed sprouts where one
      // will fall
      // (drawn over the heroes and the water instead: drawWarnings)
      if (m.kind === 'shadow' || m.kind === 'swirl' || m.kind === 'bell' || m.kind === 'lily') continue;
      if (m.kind === 'seed') { ctx.fillStyle = k ? '#c8f070' : '#5a8a2a'; ctx.fillRect(Math.round(m.x - 6 + ox), Math.round(m.y - 2 + oy), 12, 2); ctx.fillRect(Math.round(m.x - 1 + ox), Math.round(m.y - 6 + oy), 2, 4); ctx.fillRect(Math.round(m.x + 1 + ox), Math.round(m.y - 7 + oy), 3, 2); continue; }
      ctx.fillStyle = k ? '#ff6a5a' : '#902a20';
      ctx.fillRect(Math.round(m.x - 10 + ox), Math.round(m.y - 2 + oy), 20, 2);
      ctx.fillRect(Math.round(m.x - 1 + ox), Math.round(m.y - 8 + oy), 2, 4);
    }
    for (const w of g.waves) {
      const x = Math.round(w.x + ox), y = Math.round(w.y + oy);
      ctx.fillStyle = 'rgba(255,214,140,0.9)'; ctx.fillRect(x - 3, y - w.h, 6, w.h);
      ctx.fillStyle = '#fff6d0'; ctx.fillRect(x - 1, y - w.h + 2, 2, w.h - 2);
    }
  }

  drawShots(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx;
    for (const s of g.shots) {
      const x = Math.round(s.x + ox), y = Math.round(s.y + oy);
      if (s.kind === 'bolt') this.spr('foes', 23, x, y + 24 - 6, s.vx < 0);
      else if (s.kind === 'mud') this.spr('foes', 21, x, y + 24 - 5);
      else if (s.kind === 'bell') this.spr('foes', 20, x, y + 24 - 10);
      // the Windward Belfry's: hail and icicles, gust puffs, the Gale Wave, plank chunks, shards, cogs and sour notes
      else if (s.kind === 'hail') this.spr('foes', s.friendly ? 136 : 143, x, y + 6, s.vx < 0);
      else if (s.kind === 'ice') this.spr('foes', s.r >= 8 ? 143 : 137, x, y + 8, s.vx < 0);
      else if (s.kind === 'puff') this.spr('foes', 138, x, y + 8, s.vx < 0);
      else if (s.kind === 'plank') this.spr('foes', 139, x, y + 6);
      else if (s.kind === 'shard') this.spr('foes', 140, x, y + 6, s.vx < 0);
      else if (s.kind === 'cog') this.spr('foes', 141, x, y + 7);
      else if (s.kind === 'sour') this.spr('foes', 142, x, y + 6);
      else if (s.kind === 'gale') {
        // a rolling arc of wind
        const f = s.vx < 0 ? -1 : 1;
        for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(220,250,255,${0.85 - k * 0.25})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x - f * k * 6, y, s.r - k * 2, f > 0 ? -1.2 : Math.PI - 1.2 + 0.0, f > 0 ? 1.2 : Math.PI + 1.2); ctx.stroke(); }
        if (this.t % 3 === 0) this.particles.push({ x: s.x, y: s.y + (Math.random() - 0.5) * 20, vx: -f * 0.6, vy: 0, life: 0, max: 16, color: '#e8fbff', size: 1, g: 0 });
      }
      else if (s.kind === 'lily') this.lily(x, y, 1, Math.sin((this.t + s.id * 7) * 0.15) * 0.5);
      else if (s.kind === 'bubble') { ctx.strokeStyle = 'rgba(200,250,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(160,230,240,0.3)'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3, 2, 2); }
      else {
        const c = s.kind === 'water' ? ['#2a5aa0', '#7ac0ff'] : s.kind === 'seed' ? ['#3a5a1a', '#a8d050'] : s.kind === 'paint' ? ['#7a3010', '#ff9040'] : s.kind === 'lily' ? ['#3a7a50', '#e8fff0'] : ['#444', '#ccc'];
        ctx.fillStyle = c[0]; ctx.fillRect(x - s.r + 1, y - s.r + 1, s.r * 2 - 2, s.r * 2 - 2);
        ctx.fillStyle = c[1]; ctx.fillRect(x - s.r + 2, y - s.r + 2, s.r - 1, s.r - 1);
      }
    }
  }

  drawWater(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx, room = g.room;
    const real = g.arenaWater ? surfaceY(room, g.arenaWater.row) : g.waterY.get(room.id);
    const rr = roomRect(room);
    // a new water level flows in (or drains) over half a second, with streams pouring from above while it rises
    if (this.shownSurfRoom !== room.id) { this.shownSurf = real ?? null; this.shownSurfRoom = room.id; }
    const target = real ?? rr.y + rr.h + 8;
    if (this.shownSurf === null) this.shownSurf = target;
    const rising = this.shownSurf - target > 1;
    this.shownSurf += (target - this.shownSurf) * 0.08;
    if (Math.abs(this.shownSurf - target) < 0.5) this.shownSurf = target;
    if (rising) {
      for (let i = 0; i < 4; i++) {
        const sx = Math.round(rr.x + ((i + 0.5) / 4) * rr.w + ox), top = Math.max(0, rr.y + oy);
        ctx.fillStyle = 'rgba(170,220,250,0.55)'; ctx.fillRect(sx - 2, top, 4, Math.max(0, this.shownSurf + oy - top));
        ctx.fillStyle = 'rgba(230,250,255,0.7)';
        for (let yy = top + ((this.t * 4 + i * 9) % 12); yy < this.shownSurf + oy; yy += 12) ctx.fillRect(sx - 1, Math.round(yy), 1, 5);
        if (this.t % 4 === i) this.burst(sx - ox, this.shownSurf, 2, '#cfefff', 1.2, -1);
      }
    }
    if (real === undefined && !rising && this.shownSurf >= rr.y + rr.h) return;
    const surf = this.shownSurf;
    const y = Math.round(surf + oy);
    if (y > this.vh) return;
    const [r, gg, bb] = WATER_TINT[room.area] ?? WATER_TINT.halls;
    const top = Math.max(0, y);
    ctx.fillStyle = `rgba(${r},${gg},${bb},0.42)`; ctx.fillRect(0, top, this.vw, this.vh - top);
    ctx.fillStyle = `rgba(${r >> 1},${gg >> 1},${bb >> 1},0.25)`; ctx.fillRect(0, Math.max(top, y + 40), this.vw, this.vh);
    if (y >= 0) {
      // the surface: a light line that ripples, with glints
      for (let x = 0; x < this.vw; x += 2) {
        const w = Math.round(Math.sin((x - ox) * 0.07 + this.t * 0.06) * 1.2);
        ctx.fillStyle = 'rgba(210,240,255,0.75)'; ctx.fillRect(x, y + w, 2, 1);
        if (((x - ox) * 7 + this.t) % 97 < 3) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y + w - 1, 1, 1); }
      }
    }
    // rings spread where something broke the surface
    for (const r of this.ripples) {
      r.t++;
      const k = r.t / 30, ry = Math.round((Math.abs(r.y - surf) < 40 ? surf : r.y) + oy), rx = Math.round(r.x + ox), rad = 4 + k * (r.big ? 30 : 16);
      ctx.strokeStyle = `rgba(220,245,255,${(0.7 * (1 - k)).toFixed(2)})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(rx, ry, rad, rad * 0.25, 0, 0, Math.PI * 2); ctx.stroke();
    }
    this.ripples = this.ripples.filter((r) => r.t < 30);
    // floats ride the water
    const tiles = this.img.get('tiles-docks');
    for (const f of g.floatCache) for (let x = f.x0; x < f.x1; x += 16) if (tiles) ctx.drawImage(tiles, 0, 0, 16, 16, Math.round(x + ox), Math.round(f.y + oy), 16, 16);
  }

  drawParticles(ox: number, oy: number) {
    const ctx = this.ctx;
    for (const p of this.particles) {
      p.life++; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.95;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life < p.max);
  }

  // ─── lighting ────────────────────────────────────────────────────────────
  lights(g: BellspireGame): Light[] {
    const L: Light[] = [];
    const room = g.room, t = this.t;
    const flick = (k: number) => 0.88 + 0.08 * Math.sin(t * 0.21 + k * 1.7) + 0.04 * Math.sin(t * 0.53 + k * 3.1);
    // an Echo Trial run's next bell glows pale blue
    if (g.trial?.def.kind === 'run') { const goal = g.trial.def.goals[g.trial.i]; if (goal?.room === room.id) { const p = g.trialBellAt(goal); L.push({ x: p.x, y: p.y - 26, r: 70, c: [0.7, 0.9, 1], i: 0.9 * flick(5) }); } }
    // each echo note glows cyan as it appears, and dims and flickers as it fades
    for (const n of g.notes) {
      if (n.room !== room.id || n.t < n.at) continue;
      const left = n.life - n.t, k = Math.min(1, (n.t - n.at) / 10) * Math.min(1, left / 60);
      if (k <= 0) continue;
      L.push({ x: (n.x0 + n.x1) / 2, y: n.y - 4, r: 58, c: [0.45, 0.95, 1], i: 0.9 * k * (left < 60 && left % 8 < 3 ? 0.6 : 1), soft: true });
    }
    for (const th of INFO.get(room.id)!.things) {
      const x = th.c * TILE + 8, y = th.r * TILE + 8;
      if (th.ch === 'T') {
        // (a Cloudstair bell post stands on the floor below its mark: its glow is at the post's lamp)
        const fy = postFloor(room, th.c, th.r);
        L.push({ x, y: fy !== null ? fy - 44 : y - 4, r: 112, c: [1, 0.6, 0.28], i: 1.25 * flick(th.c) });
      }
      // an echo bell: a faint cyan shimmer, bright while its notes hang in the air; a wind bell catches the light,
      // flaring when it is rung
      else if (th.ch === 'Q') { const lit = g.notes.some((n) => n.key.startsWith(`${room.id}:${th.i}:`)); L.push({ x, y: y - 6, r: lit ? 96 : 44, c: [0.45, 0.95, 1], i: lit ? 1.1 + 0.15 * Math.sin(t * 0.2) : 0.45 }); }
      else if (th.ch === 'W') { const sw = this.bellSwing.get(`w${th.c},${th.r}`) ?? 0; L.push({ x, y: y - 10, r: 44 + sw * 1.5, c: [0.85, 0.95, 1], i: 0.4 + sw / 40 }); }
      else if (th.ch === 'i') L.push({ x, y, r: 64, c: [1, 0.7, 0.38], i: 0.95 * flick(th.c + 9) });
      else if (th.ch === 'S') { const lit = g.flag(`shrine:${room.id}`) || g.save.shrine === room.id; L.push({ x, y: y - 8, r: lit ? 110 : 60, c: [1, 0.66, 0.36], i: (lit ? 1.15 : 0.6) * flick(th.c) }); }
      else if (th.ch === 'w') { L.push({ x, y: y + 8, r: 100, c: [0.6, 0.78, 1], i: 0.8 }); L.push({ x: x + 22, y: y + 96, r: 84, c: [0.55, 0.72, 1], i: 0.45, soft: true }); L.push({ x: x + 40, y: y + 170, r: 70, c: [0.55, 0.72, 1], i: 0.3, soft: true }); }
      else if (th.ch === 'A' && room.ability && !g.has(room.ability)) L.push({ x, y: y - 10, r: 70, c: hexRgb(ABILITIES[room.ability].color), i: 1 + 0.2 * Math.sin(t * 0.08) });
      else if (th.ch === 'B') L.push({ x, y: y - 10, r: 50, c: [1, 0.85, 0.5], i: 0.55 });
      else if (th.ch === 'U') L.push({ x, y: y - 10, r: 70, c: [0.5, 0.7, 1], i: 0.8 });
      else if (th.ch === 'M') L.push({ x: x + 10, y: y - 4, r: 70, c: [1, 0.75, 0.45], i: 0.8 * flick(3) });
      else if (th.ch === 'R') L.push({ x, y: y - 6, r: 34, c: [1, 0.85, 0.55], i: 0.5 });
    }
    for (const d of INFO.get(room.id)!.doors) if (!g.doorOpen(d)) {
      const ab = ({ d: 'dash', j: 'double', k: 'wallkick', l: 'lantern', c: 'chime' } as Record<string, keyof typeof ABILITIES>)[d.ch];
      if (ab) L.push({ x: (d.c + d.w / 2) * TILE, y: (d.r + d.h / 2) * TILE, r: 40, c: hexRgb(ABILITIES[ab].color), i: 0.7 });
    }
    for (const e of g.enemies) { const f = FOES[e.kind]; if (e.alive && !e.hidden && f.light) L.push({ x: e.x, y: e.y - f.h / 2, r: f.light[3], c: [f.light[0], f.light[1], f.light[2]], i: 0.9 }); }
    for (const s of g.shots) if (s.kind === 'bolt') L.push({ x: s.x, y: s.y, r: 50, c: [1, 0.7, 0.35], i: 1.1 }); else if (s.kind === 'bell') L.push({ x: s.x, y: s.y, r: 30, c: [1, 0.8, 0.4], i: 0.6 });
    if (g.embers) { const c = g.lead === 'enzo' ? g.body : g.follower; L.push({ x: c.x, y: c.y - 12, r: 80, c: [1, 0.55, 0.25], i: 1.1 }); }
    for (const p of this.pulses) L.push({ x: p.x, y: p.y, r: p.r * (0.4 + p.t / 30), c: p.c, i: 0.9 * (1 - p.t / 24) });
    // the water glows teal along its surface
    const surf = g.arenaWater ? surfaceY(room, g.arenaWater.row) : g.waterY.get(room.id);
    if (surf !== undefined) { const rr = roomRect(room); for (let x = rr.x + 48; x < rr.x + rr.w; x += 96) L.push({ x, y: surf + 10, r: 72, c: [0.3, 0.85, 0.8], i: 0.32, soft: true }); }
    // a sword or staff swing flashes on the walls nearby
    const act = g.leadRt.act;
    if (act && (act.kind === 'swing' || act.kind === 'thrust' || act.kind === 'whirl') && act.t < 8) L.push({ x: g.body.x + g.body.face * 16, y: g.body.y - 16, r: 72, c: g.lead === 'dora' ? [0.85, 0.95, 1] : [1, 0.85, 0.6], i: 0.9 * (1 - act.t / 8) });
    // the heroes always glow a little, so they can be seen in the dark
    L.push({ x: g.body.x, y: g.body.y - 18, r: 40, c: [0.85, 0.85, 1], i: 0.3 });
    // Enzo's lantern
    if (g.lanternR > 1) {
      // the lantern's light follows Enzo's weapon: the Star Lamp burns star-white and brighter
      const e = g.enzoPos(), look = WEAPON_LOOK[this.worn.enzo.weapon];
      L.push({ x: e.x, y: e.y - 10, r: g.lanternR, c: look?.light ?? [1, 0.8, 0.5], i: (g.lanternUp ? 1.15 : 0.9) * (look?.lightMul ?? 1) * (0.96 + 0.04 * Math.sin(t * 0.3)), soft: g.lanternUp });
    }
    // the Salt Lamp: a soft pink light that follows whoever carries it
    for (const h of ['dora', 'enzo'] as HeroId[]) if (g.save.equip[h].relic === 'salt-lamp' && !g.save.heroes[h].down) {
      const p = h === g.lead ? g.body : g.follower;
      L.push({ x: p.x, y: p.y - 16, r: 54, c: [1, 0.62, 0.72], i: 0.5, soft: true });
    }
    if (this.wispA > 0.02) L.push({ x: g.wisp.x, y: g.wisp.y, r: 30, c: [0.7, 0.95, 1], i: 0.55 * this.wispA, soft: true });
    if (g.boss?.id === 'warden' && (g.boss.st === 'rest' || g.boss.st === 'drop')) { const bd = g.boss.body; L.push({ x: bd.x + bd.w / 2, y: bd.y + bd.h - 10, r: 120, c: [1, 0.6, 0.25], i: 1 }); }
    // a key light on a guardian in a fight, so it reads against the dimmed room
    if (g.boss && !g.boss.calm && g.boss.st !== 'wait') { const bd = g.boss.body; L.push({ x: bd.x + bd.w / 2, y: bd.y + bd.h * 0.35, r: Math.max(bd.w, bd.h) * 0.9 + 50, c: [1, 0.95, 0.85], i: 0.42, soft: true }); }
    if (g.boss?.id === 'mother') L.push({ x: g.boss.body.x + 35, y: g.boss.body.y + 30, r: 160, c: [0.4, 0.9, 0.9], i: 0.7 });
    return L;
  }

  drawLight(g: BellspireGame, cx: number, cy: number) {
    const room = g.room;
    let amb = AREAS[room.area].ambient;
    if (room.dark) amb = [Math.max(0.2, amb[0] * 0.5), Math.max(0.19, amb[1] * 0.5), Math.max(0.27, amb[2] * 0.6)]; // a floor, so walls never vanish
    else amb = [Math.min(1, amb[0] * 1.35), Math.min(1, amb[1] * 1.35), Math.min(1, amb[2] * 1.35)];
    const lights = this.lights(g);
    const W = this.light.width, H = this.light.height, d = this.ldata.data, gd = this.gdata.data;
    const surf = g.arenaWater ? surfaceY(room, g.arenaWater.row) : g.waterY.get(room.id);
    const LX = new Float32Array(lights.length), LY = new Float32Array(lights.length), LR2 = new Float32Array(lights.length), LS = lights.map((l) => !!l.soft);
    lights.forEach((l, i) => { LX[i] = (l.x - cx) / 2; LY[i] = (l.y - cy) / 2; LR2[i] = (l.r / 2) ** 2; });
    const t = this.t;
    for (let y = 0; y < H; y++) {
      const wy = cy + y * 2;
      const under = surf !== undefined && wy > surf;
      for (let x = 0; x < W; x++) {
        let r = amb[0], gg = amb[1], b = amb[2];
        for (let i = 0; i < lights.length; i++) {
          const dx = x - LX[i], dy = y - LY[i], q = dx * dx + dy * dy;
          if (q >= LR2[i]) continue;
          const f = 1 - q / LR2[i], k = (LS[i] ? Math.min(1, f * 1.6) * (0.55 + 0.45 * f) : f * f) * lights[i].i;
          r += lights[i].c[0] * k; gg += lights[i].c[1] * k; b += lights[i].c[2] * k;
        }
        if (under) {
          // caustics: soft moving bands of light under the water
          const wx = cx + x * 2;
          const c = Math.sin(wx * 0.09 + t * 0.05) * Math.sin(wy * 0.11 - t * 0.04) + Math.sin((wx + wy) * 0.05 + t * 0.03);
          const k = c > 1.15 && c < 1.4 ? 0.14 : c > 0.95 && c < 1.15 ? 0.05 : 0; // thin bright threads, not blotches
          r += k * 0.6; gg += k * 0.9; b += k;
        }
        // a soft knee above full light, so stacked lights glow without burning the sprites to white
        if (r > 1) r = 1 + (r - 1) / (1 + (r - 1) * 1.5);
        if (gg > 1) gg = 1 + (gg - 1) / (1 + (gg - 1) * 1.5);
        if (b > 1) b = 1 + (b - 1) / (1 + (b - 1) * 1.5);
        // bands: light falls off in steps, like hand-placed pixel shading
        r = Math.round(r * 10) / 10; gg = Math.round(gg * 10) / 10; b = Math.round(b * 10) / 10;
        const o = (y * W + x) * 4;
        d[o] = Math.min(255, r * 255); d[o + 1] = Math.min(255, gg * 255); d[o + 2] = Math.min(255, b * 255); d[o + 3] = 255;
        gd[o] = Math.max(0, r - 1) * 100; gd[o + 1] = Math.max(0, gg - 1) * 100; gd[o + 2] = Math.max(0, b - 1) * 100; gd[o + 3] = 255;
      }
    }
    this.lctx.putImageData(this.ldata, 0, 0);
    this.gctx.putImageData(this.gdata, 0, 0);
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light, 0, 0, W * 2, H * 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.glow, 0, 0, W * 2, H * 2);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** God rays from windows and dust motes drifting through them. */
  drawRays(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const th of INFO.get(g.room.id)!.things) {
      if (th.ch !== 'w') continue;
      const x = th.c * TILE + 8 + ox, y = th.r * TILE + oy;
      if (x < -200 || x > this.vw + 200) continue;
      for (let i = 0; i < 3; i++) {
        const a = 0.05 + 0.02 * Math.sin(this.t * 0.02 + i * 2);
        ctx.fillStyle = `rgba(190,215,255,${a})`;
        ctx.beginPath(); ctx.moveTo(x - 6 + i * 4, y - 10); ctx.lineTo(x + 2 + i * 4, y - 10); ctx.lineTo(x + 70 + i * 16, y + 150); ctx.lineTo(x + 40 + i * 16, y + 150); ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 10; i++) {
        const k = hash(th.c, i), p = ((this.t * (0.3 + (k % 5) * 0.06) + (k % 200)) % 150) / 150;
        const mx = x + 10 + p * 60 + ((k >> 4) % 30) + Math.sin(this.t * 0.03 + i) * 3, my = y + p * 140;
        ctx.fillStyle = `rgba(255,250,220,${0.5 * Math.sin(p * Math.PI)})`; ctx.fillRect(Math.round(mx), Math.round(my), 1, 1);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export { surfaceRow, HERO_H, ABILITY_ORDER, groupAt };
