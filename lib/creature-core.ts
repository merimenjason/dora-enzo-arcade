// Every Creature, Chapter One: the shared core. Forms and their tuning, who can ride whom, the seeded random stream,
// the live game/screen bindings, level geometry (floors, walls, surfaces), effects and the sound/event queues. Pure:
// no DOM. Worlds are 1920×1080; every picture is painted (public/art/every-creature/), code draws only effects.
// Ported from the standalone prototype (arcade-protos/creature/js/core.js) with the same numbers.

export type Form = 'chin' | 'tort' | 'frog' | 'bird' | 'beetle' | 'fox' | 'otter';
export type Name = 'dora' | 'enzo';
export const FORMS: Form[] = ['chin', 'tort', 'frog', 'bird', 'beetle', 'fox', 'otter'];
/** the number key for each form (0 is back to chinchilla) */
export const FKEY: Record<Form, string> = { chin: '0', tort: '1', frog: '2', bird: '3', beetle: '4', fox: '5', otter: '6' };

export interface FormParams {
  w: number; h: number; spd: number; jump?: number; g: number; swimSpd?: number; wjump?: number; air?: number; flap?: number; cflap?: number;
  glide?: number; maxFlaps?: number; climb?: number; swim?: 1; sink?: number; light?: 1; heavy?: 1; ride?: 1;
}
export const F: Record<Form, FormParams> = {
  chin: { w: 44, h: 118, spd: 300, jump: 640, g: 1900, ride: 1 },
  frog: { w: 56, h: 60, spd: 290, swimSpd: 250, jump: 930, wjump: 540, g: 2000, swim: 1, sink: 14, light: 1, ride: 1 },
  tort: { w: 120, h: 78, spd: 150, swimSpd: 170, g: 1900, swim: 1, sink: 34, heavy: 1 },
  bird: { w: 54, h: 70, spd: 230, air: 300, flap: 520, cflap: 455, g: 1150, glide: 90, maxFlaps: 6, light: 1 },
  beetle: { w: 60, h: 44, spd: 235, jump: 520, g: 1900, climb: 175, light: 1, ride: 1 },
  fox: { w: 84, h: 64, spd: 350, jump: 720, g: 1900, ride: 1 },
  otter: { w: 90, h: 50, spd: 190, swimSpd: 430, jump: 470, wjump: 470, g: 1900, swim: 1, sink: 16 },
};
/** who can ride on whose back */
export const CARRY: Partial<Record<Form, Form[]>> = { tort: ['chin', 'frog', 'beetle'], fox: ['frog', 'beetle'], otter: ['chin', 'frog', 'beetle', 'fox'] };

export interface Input { mx: number; my: number; actP: boolean; actH: boolean; upP: boolean; formP: number; formSet: Form | null; swapP: boolean; callP: boolean }
export const NOINP: Input = { mx: 0, my: 0, actP: false, actH: false, upP: false, formP: 0, formSet: null, swapP: false, callP: false };

export interface Rect { id: string; x1: number; y1: number; x2: number; y2: number; rampSkip?: 1; noTop?: 1; noBottom?: 1; thorn?: 1 }
export interface Wall { x: number; top: number; bot: number; slick?: number; kind: string; exitX?: number }
export interface Vine { x: number; top: number; bot: number; exitX: number; exitY: number; on: () => boolean }
export interface Ramp { pts: [number, number][]; on: () => boolean }
export interface Pad { x: number; w: number; img: string; dip?: number }
export interface Water { x1: number; x2: number; y: number; dive?: number }
export interface Level {
  W: number; H: number; bank: [number, number][]; rects: Rect[]; water?: Water; current?: { x1: number; x2: number; v: number };
  walls?: Wall[]; vines?: Vine[]; ramps?: Ramp[]; pads?: Pad[]; unsafe?: string[];
}
export interface WallHit { dir: number; x: number; top: number; bot: number; slick?: number; kind: string; exitX?: number }
export interface Surface { y: number; kind: string; ref?: Hero | Pad }
export type Hint = { k: 'move' | 'act' | 'up' | 'down' | 'form' | 'swap' | 'call'; d?: number; f?: Form } | null;
export interface Pose { img?: string; x: number; y: number; h?: number; f?: number; rot?: number; spark?: 1; bolt?: 1 }

export interface Hero {
  name: Name; x: number; y: number; vx: number; vy: number; face: number; form: Form; ground: boolean; t: number; anim: number;
  flaps: number; flapT: number; climb: null | 'vine' | 'wall'; ride: Hero | null; rider: Hero | null; carry: Hero | null; carryT: number;
  hurt: number; shell: boolean; swim: boolean; dive: boolean; landT: number; friendT: number; nudgeT: number; digT: number; respawn: number;
  lastSafe: { x: number; y: number }; slipT: number; knock: number; poofT: number; surf: string; inp: Input | null;
  offAt: number; boardT: number; denyT: number; arriveT: number; zoneT: number; danger: boolean;
  longJump?: boolean; bx?: number; by?: number; stayOff?: boolean; dropAt?: number; under?: number; underTo?: number; vineR?: Vine; wall?: WallHit;
  climbAnim?: number; grip?: number; slipSnd?: number; wallHit?: number; arrTo?: { x: number; y: number } | null; arrOn?: Hero | null;
  digging?: boolean; flung?: number; inp2?: Input | null; bumped?: number;
}

export interface Particle { x: number; y: number; vx: number; vy: number; g: number; life: number; t: number; k: string; c?: string; r: number; rot: number; vr: number }
export interface ScreenStat { i: number; t0: number; swaps0: number; forms0: number; calls0: number; time: number | null }
export interface Stats {
  formChanges: number; swaps: number; calls: number; denied: number; splashes: number; hits: number; blocks: number; slips: number;
  friendAt: Record<string, number>; puzzleAt: Record<string, number>; inputs: number; scr: (ScreenStat | undefined)[];
}
export type Mode = 'title' | 'play' | 'trans' | 'end';
export type Friends = Record<Exclude<Form, 'chin'>, boolean>;
/** a sound for the page to play: an effect id (or `v:<form>` for a form's voice), an argument and a delay in seconds */
export interface Sfx { id: string; n?: number; delay?: number }
export type Ev = [string, number, ...unknown[]];

export interface Game {
  t: number; total: number; si: number; mode: Mode; assist: boolean; two: boolean; act: number; heroes: [Hero, Hero]; friends: Friends;
  fx: Particle[]; poofs: { x: number; y: number; t: number; s: number }[]; rings: { x: number; y: number; t: number; life: number; r: number; c?: string }[];
  flyIcons: { kind: Form; x: number; y: number; t: number }[]; shake: number; clear: boolean; clearT: number; transT: number; endT: number; endFull?: boolean; nextSi?: number;
  demo: { kind: string; t: number; dur: number } | null; demoCool: number; idleT: number; stuckT: number; scheme: 'arrows' | 'wasd'; ev: Ev[];
  S: unknown; stats: Stats; tune: string | null; sfx: Sfx[];
}

/** a screen of the chapter: its level, its rules, and the hooks the hero physics calls into */
export interface Screen {
  id: string; name: string; tune: string; bg: string; art: string[]; LV: Level; start: [number, number][]; camWin: { x: number; y: number };
  init(): unknown; stage(): string; goal(): boolean; update(dt: number): void; celebrate(i: number): { x: number; y: number }; hint(): Hint;
  actNear(h: Hero): boolean; wantDemo(s: string): boolean; demoDur(s: string): number; demoPose(d: { kind: string; t: number; dur: number }): Pose[];
  zone?(x: number, y: number, h?: Hero): string | number; linked?(a: string | number, b: string | number): boolean; pair?(f: Form, a: Hero): Form | null;
  noForm?(h: Hero): boolean; block?(h: Hero): void; birdCap?(h: Hero): void; carryLand?(h: Hero, s: Surface): boolean; onJump?(h: Hero): void;
  landed?(h: Hero, s: Surface, v: number): void; thorn?(h: Hero, w: { x: number; side: number; r: Rect }): void; swimTick?(h: Hero, dt: number): void;
  surfaces?(e: Hero, x: number, cand: (y: number, kind: string, ref?: Hero | Pad) => void): void; rects?(): Rect[];
  stay?(b: Hero): boolean; ai?(b: Hero, a: Hero): Input | null; callSpot?(a: Hero, b: Hero): { x: number; y: number } | null; onClear?(): void;
}

// ---------------------------------------------------------------- live bindings (the game being played and its screen)
export let G: Game = null as unknown as Game;
export let LV: Level = null as unknown as Level;
export let SCR: Screen = null as unknown as Screen;
export function bindGame(g: Game) { G = g; }
export function bindScreen(s: Screen) { SCR = s; LV = s.LV; }

// ---------------------------------------------------------------- seeded random, helpers
let rs = 1;
export function seedRnd(n: number) { rs = n; }
export const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
export const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sm = (u: number) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
export const H = () => G.heroes[G.act], O = () => G.heroes[1 - G.act];
export const other = (h: Hero) => G.heroes[h === G.heroes[0] ? 1 : 0];
export const ev = (name: string, ...a: unknown[]) => { G.ev.push([name, +G.t.toFixed(1), ...a]); if (G.ev.length > 4000) G.ev.splice(0, 1000); };
/** queue a sound for the page */
export const snd = (id: string, n?: number, delay?: number) => { if (G.sfx.length < 64) G.sfx.push({ id, n, delay }); };
export const voice = (f: Form, delay?: number) => snd('v:' + f, undefined, delay);
export const backY = (c: Hero) => c.form === 'tort' ? 74 - (c.shell ? 12 : 0) : c.form === 'fox' ? 48 : c.form === 'otter' ? (c.swim ? 20 : 40) : 0;
export const canRide = (r: Hero, c: Hero) => !!(CARRY[c.form] && CARRY[c.form]!.includes(r.form));
export const unlocked = (f: Form) => f === 'chin' || G.friends[f];

// ---------------------------------------------------------------- geometry (the current screen = LV)
export function polyY(pts: [number, number][], x: number) {
  if (x < pts[0][0] || x > pts[pts.length - 1][0]) return Infinity;
  for (let i = 0; i < pts.length - 1; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; if (x >= x1 && x <= x2) return y1 + (y2 - y1) * (x - x1) / (x2 - x1); }
  return Infinity;
}
export const inWaterX = (x: number) => !!LV.water && x > LV.water.x1 && x < LV.water.x2;
export const rampsOn = () => (LV.ramps || []).filter((r) => r.on());
export function floorAt(x: number) { let y = polyY(LV.bank, x); for (const r of rampsOn()) y = Math.min(y, polyY(r.pts, x)); return y; }
export function allRects(): Rect[] { return SCR.rects ? LV.rects.concat(SCR.rects()) : LV.rects; }
export function padAt(x: number) { for (const p of LV.pads || []) if (Math.abs(x - p.x) < p.w / 2) return p; return null; }
/** the highest surface at x between yFrom-tol and yTo */
export function surface(e: Hero, x: number, yFrom: number, yTo: number, tol: number): Surface | null {
  let best: Surface | null = null;
  const P = F[e.form], hw = Math.min(P.w / 2, 40) * .6;
  const cand = (y: number, kind: string, ref?: Hero | Pad) => { if (y >= yFrom - tol && y <= yTo && (!best || y < best.y)) best = { y, kind, ref }; };
  cand(polyY(LV.bank, x), 'bank');
  for (const r of rampsOn()) cand(polyY(r.pts, x), 'ramp');
  for (const r of allRects()) if (!r.noTop && x + hw > r.x1 && x - hw < r.x2) cand(r.y1, r.id);
  if (P.light) { const p = padAt(x); if (p) cand(LV.water!.y - 3, 'pad', p); }
  else if (e.form === 'chin') { const p = padAt(x); if (p) cand(LV.water!.y - 3, 'padsink', p); }
  const t = other(e);
  if (canRide(e, t) && !e.stayOff && !t.rider && !t.respawn && !t.dive && !t.ride && Math.abs(t.x - x) < F[t.form].w * .48) cand(t.y - backY(t), 'back', t);
  if (SCR.surfaces) SCR.surfaces(e, x, cand);
  return best;
}
export function wallBlock(e: Pick<Hero, 'form' | 'y' | 'dive' | 'surf' | 'ground' | 'x'>, nx: number) {
  const P = F[e.form], hw = Math.min(P.w / 2, 46);
  const top = e.y - (e.dive ? 36 : P.h) + 4, bot = e.y - 4;
  for (const r of allRects()) {
    if (r.rampSkip && e.surf === 'ramp') continue;
    if (bot <= r.y1 + (e.ground ? 16 : 2) || top >= r.y2) continue;
    if (nx + hw > r.x1 && nx - hw < r.x2) {
      if (e.x <= r.x1) return { x: r.x1 - hw, side: 1, r };
      if (e.x >= r.x2) return { x: r.x2 + hw, side: -1, r };
    }
  }
  return null;
}

// ---------------------------------------------------------------- effects (particles live in the game so they are deterministic)
export interface FxOpts { a?: number; spread?: number; s?: number; w?: number; g?: number; life?: number; k?: string; c?: string; r?: number }
export function fx(x: number, y: number, n: number, o: FxOpts = {}, r: () => number = rnd) {
  for (let i = 0; i < n; i++) {
    const a = o.a != null ? o.a + (r() - .5) * (o.spread || 1) : r() * Math.PI * 2, s = (o.s || 200) * (.4 + r() * .8);
    G.fx.push({ x: x + (r() - .5) * (o.w || 0), y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: o.g ?? 600, life: (o.life || .7) * (.6 + r() * .6), t: 0, k: o.k || 'drop', c: o.c, r: (o.r || 5) * (.6 + r() * .8), rot: r() * 6, vr: (r() - .5) * 8 });
  }
}
export const splash = (x: number, y: number, big = 1) => { fx(x, y, 14 * big, { a: -Math.PI / 2, spread: 1.6, s: 330 * Math.sqrt(big), g: 1100, k: 'drop', r: 5 }); G.rings.push({ x, y, t: 0, life: .9, r: 30 * big }); };
export const sparkle = (x: number, y: number, n = 18, c?: string) => fx(x, y, n, { s: 220, g: -40, k: 'star', life: 1, r: 9, c });
export const feathers = (x: number, y: number, n: number, c?: string) => fx(x, y, n, { s: 120, g: 90, k: 'feather', life: 1.4, r: 9, c });
export const dirt = (x: number, y: number, n: number) => fx(x, y, n, { a: -Math.PI / 2, spread: 2, s: 260, g: 1300, k: 'dirt', life: .8, r: 6 });
export const poof = (x: number, y: number, s = 1) => { G.poofs.push({ x, y, t: 0, s }); fx(x, y, 8, { s: 160, g: 60, k: 'leaf', life: 1, r: 7 }); };
export const ring = (x: number, y: number, r: number, c = 'gold', life = .5) => G.rings.push({ x, y, t: 0, life, r, c });
/** age the effects; the page calls it once a frame, the bots once a step */
export function tickFx(dt: number) {
  for (const p of G.fx) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.k === 'feather' || p.k === 'petal') { p.vx *= .97; p.vy = Math.min(p.vy, 70); p.x += Math.sin(p.t * 4 + p.rot) * 30 * dt; } }
  G.fx = G.fx.filter((p) => p.t < p.life); if (G.fx.length > 500) G.fx.splice(0, G.fx.length - 500);
  for (const p of G.poofs) p.t += dt; G.poofs = G.poofs.filter((p) => p.t < .4);
  for (const r of G.rings) r.t += dt; G.rings = G.rings.filter((r) => r.t < r.life);
  for (const f of G.flyIcons) f.t += dt; G.flyIcons = G.flyIcons.filter((f) => f.t < 1.2);
}
