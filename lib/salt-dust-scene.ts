// Salt & Dust: drawing only (Canvas 2D). The painted backgrounds, every figure from its painted strip with its own frames
// for each action, the isometric floor glows for paths, movement range and targets, the travel map, and the little
// floating numbers in a fight. All the art is Codex-painted (see scripts/salt-dust-art.py); the code only places it.
import {
  MAPS, MAP_NODES, TW, TH, VIEW_W, VIEW_H, LLAMAS, LEG_TIME, FIND_TIME, TALK, FRAMES,
  type SaltGame, type Unit, type CombatEvent, type Dir, type SpriteId, type MapDef, type Place, type NodeId,
} from './salt-dust-game';
import { ART } from './salt-dust-art';

/** how long each one-shot action takes, seconds */
const ACT_TIME: Record<string, number> = { attack: 0.6, hit: 0.5, mend: 1.1, drink: 1.1, talk: 1.4, salute: 1.4, pour: 1.6, point: 1.6, wave: 1.4, cheer: 1.5 };
/** an NPC's action while a line is on screen */
const LINE_ACT: Record<string, [string, string]> = {
  'parina.sold': ['parina', 'pour'], 'parina.mended': ['parina', 'pour'], 'captain.paid': ['captain', 'salute'], 'captain.fixed': ['captain', 'salute'],
  'captain.share': ['captain', 'salute'], 'wayra.yard': ['wayra', 'point'], 'wayra.tracks': ['wayra', 'point'], 'tika.mast': ['tika', 'wave'],
  'tika.guild': ['tika', 'wave'], 'tika.share': ['tika', 'wave'], 'tika.toll': ['tika', 'talk'],
};
const IMAGES = ['dora', 'enzo', 'fox', 'warden', 'parina', 'wayra', 'llama', 'bg-town', 'bg-yard', 'bg-map', 'ev-caravan', 'ev-islands', 'ev-runners',
  'tile-move', 'tile-attack', 'tile-grid', 'ui-brackets', 'ui-tag', 'ui-pip', 'ui-pip-empty'];

export function tileCenter(m: MapDef, x: number, y: number) { return { x: m.ox + (x - y) * TW / 2, y: m.oy + (x + y) * TH / 2 + TH / 2 }; }
export function screenTile(m: MapDef, px: number, py: number): [number, number] {
  const a = (px - m.ox) / (TW / 2), b = (py - m.oy) / (TH / 2);
  return [Math.floor((a + b) / 2), Math.floor((b - a) / 2)];
}
const hash = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 997; return h / 997; };

export interface Pick { kind: 'npc' | 'spot' | 'unit' | 'tile'; id: string; x: number; y: number }
export interface SceneUi {
  hover: [number, number] | null; px: number; py: number;
  /** combat: show reach and odds */
  help: boolean;
  /** combat: what a click on a hero does */
  aim: 'act' | 'mend';
}
interface Float { x: number; y: number; text: string; color: string; t: number }

export class SaltScene {
  c: CanvasRenderingContext2D;
  img: Record<string, HTMLImageElement> = {};
  loaded = 0;
  /** one-shot actions playing on a figure: id → action and when it started */
  acts = new Map<string, { act: string; t0: number; dur: number }>();
  /** where each fighter is drawn (tiles, may be between tiles while walking) and the walk being played */
  disp = new Map<string, { x: number; y: number; path: [number, number][]; seg: number; walking: boolean }>();
  queue: CombatEvent[] = [];
  cur: { ev: CombatEvent; t: number; dur: number; fired: boolean } | null = null;
  floats: Float[] = [];
  /** the boxes the figures were last drawn in, for clicks, topmost last */
  boxes: { kind: 'npc' | 'unit' | 'spot'; id: string; x0: number; y0: number; x1: number; y1: number }[] = [];
  now = 0;
  lastTalk = '';
  onSound: (s: string) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W; canvas.height = VIEW_H;
    this.c = canvas.getContext('2d')!;
  }
  load(base = '/art/salt-dust/'): Promise<void> {
    return Promise.all(IMAGES.map((n) => new Promise<void>((res) => {
      const im = new Image(); im.onload = () => { this.loaded++; res(); }; im.onerror = () => res(); im.src = `${base}${n}.webp`; this.img[n] = im;
    }))).then(() => {});
  }

  // ─── one-shot actions and the fight's event queue ───
  play(id: string, act: string, dur = ACT_TIME[act] ?? 1) { this.acts.set(id, { act, t0: this.now, dur }); }
  acting(id: string) { const a = this.acts.get(id); if (!a) return null; if (this.now - a.t0 > a.dur) { this.acts.delete(id); return null; } return a; }
  /** queue a fight's events to animate; a new turn has nothing to show, so it never holds up a click */
  feed(evs: CombatEvent[]) { this.queue.push(...evs.filter((e) => e.k !== 'turn')); }
  busy() { return !!this.cur || this.queue.length > 0; }
  resetFight() { this.disp.clear(); this.queue = []; this.cur = null; this.floats = []; }
  private syncUnits(g: SaltGame) {
    for (const u of g.combat?.units ?? []) if (!this.disp.has(u.id)) this.disp.set(u.id, { x: u.x, y: u.y, path: [], seg: 0, walking: false });
  }
  private startEvent(g: SaltGame, ev: CombatEvent) {
    let dur = 0.2;
    if (ev.k === 'move') {
      const d = this.disp.get(ev.id)!; d.path = ev.path.slice(); d.seg = 0; d.walking = true;
      dur = ev.path.length / 4.5 + 0.05; this.onSound('step');
    } else if (ev.k === 'attack') { this.play(ev.id, 'attack'); dur = 1.0; this.onSound(ev.id === 'dora' ? 'sling' : 'swing'); }
    else if (ev.k === 'mend') { this.play(ev.id, 'mend'); dur = 1.15; this.onSound('mend'); }
    else if (ev.k === 'drink') { this.play(ev.id, 'drink'); dur = 1.15; this.onSound('pour'); }
    else if (ev.k === 'down') dur = 0.5;
    else if (ev.k === 'surrender') { dur = 1.0; const t = this.unitAt(g, 'tika'); if (t) this.float(t.x, t.y, 'The Runners give up!', '#ffe7a8'); }
    else if (ev.k === 'over') dur = 0.6;
    else if (ev.k === 'turn') dur = 0.25;
    this.cur = { ev, t: 0, dur, fired: false };
  }
  private unitAt(g: SaltGame, id: string) { const u = g.combat?.units.find((q) => q.id === id); if (!u) return null; const d = this.disp.get(id); return d ? { x: d.x, y: d.y } : { x: u.x, y: u.y }; }
  float(x: number, y: number, text: string, color: string) { this.floats.push({ x, y, text, color, t: 0 }); }
  private updateFight(g: SaltGame, dt: number) {
    this.syncUnits(g);
    for (const d of this.disp.values()) {
      if (!d.walking) continue;
      d.seg += dt * 4.5;
      while (d.seg >= 1 && d.path.length) { const [x, y] = d.path.shift()!; d.x = x; d.y = y; d.seg -= 1; }
      if (!d.path.length) { d.walking = false; d.seg = 0; }
    }
    if (!this.cur && this.queue.length) this.startEvent(g, this.queue.shift()!);
    const cur = this.cur;
    if (!cur) return;
    cur.t += dt;
    const ev = cur.ev;
    if (ev.k === 'attack' && !cur.fired && cur.t > 0.42) {
      cur.fired = true;
      const p = this.unitAt(g, ev.target);
      if (p) {
        if (ev.hit) { this.play(ev.target, 'hit'); this.float(p.x, p.y, `−${ev.dmg}`, '#ffb38a'); this.onSound('hit'); }
        else { this.float(p.x, p.y, 'Miss', '#e8f4f2'); this.onSound('miss'); }
      }
    }
    if ((ev.k === 'mend' || ev.k === 'drink') && !cur.fired && cur.t > 0.6) {
      cur.fired = true;
      const p = this.unitAt(g, ev.k === 'mend' ? ev.target : ev.id);
      if (p) this.float(p.x, p.y, `+${ev.heal}`, '#9ff5e4');
    }
    if (ev.k === 'down' && !cur.fired) { cur.fired = true; this.onSound('down'); }
    if (cur.t >= cur.dur) this.cur = null;
  }

  // ─── drawing a figure ───
  private sprite(name: SpriteId, frame: number, sx: number, sy: number, flip: boolean, alpha = 1, scale = 1) {
    const im = this.img[name]; const a = ART[name];
    if (!im || !im.complete || !im.naturalWidth || !a) return null;
    const [W, H, , foot, mid] = a;
    const c = this.c;
    c.save(); c.globalAlpha = alpha;
    c.translate(sx, sy); c.scale(flip ? -scale : scale, scale);
    c.drawImage(im, frame * W, 0, W, H, -mid, -foot, W, H);
    c.restore();
    const w = W * scale, top = sy - foot * scale;
    const x0 = flip ? sx - (W - mid) * scale : sx - mid * scale;
    return { x0, y0: top, x1: x0 + w, y1: top + H * scale };
  }
  private shadow(x: number, y: number, w = 46) {
    const c = this.c; c.save(); c.globalAlpha = 0.28; c.fillStyle = '#3a2418';
    c.beginPath(); c.ellipse(x, y - 2, w, w * 0.34, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }
  /** the frame for an action at a time: loops unless `once` */
  private frameOf(sp: SpriteId, act: string, t: number, fps: number, once = false) {
    const fr = FRAMES[sp][act] ?? FRAMES[sp].idle;
    const i = Math.floor(t * fps);
    return fr[once ? Math.min(fr.length - 1, i) : i % fr.length];
  }
  /** draw a hero or a Runner: the one-shot action if one's playing, else walking or standing, the right way round */
  private figure(id: string, sp: SpriteId, x: number, y: number, dir: Dir, opts: { walking?: boolean; down?: boolean; talking?: boolean; act?: string | null; alpha?: number }) {
    const back = dir === 'bl' || dir === 'br';
    const hasBack = !!FRAMES[sp].backWalk;
    const one = this.acting(id);
    let act: string, flip: boolean, fps = 7, once = false, t = this.now + hash(id) * 3;
    const frontFlip = dir === 'fl' || dir === 'bl';
    if (one) { act = one.act; t = this.now - one.t0; fps = (FRAMES[sp][act]?.length ?? 1) / one.dur; once = true; flip = frontFlip; }
    else if (opts.down) { act = 'down'; flip = frontFlip; }
    else if (opts.act) { act = opts.act; flip = frontFlip; fps = 2.2; }
    else if (opts.walking) { act = back && hasBack ? 'backWalk' : 'walk'; flip = back && hasBack ? dir === 'br' : frontFlip; fps = 9; }
    else if (opts.talking) { act = 'talk'; flip = frontFlip; fps = 2.5; }
    else { act = back && hasBack ? 'backIdle' : 'idle'; flip = back && hasBack ? dir === 'br' : frontFlip; fps = 1.4; }
    const f = this.frameOf(sp, act, t, fps, once);
    this.shadow(x, y, sp === 'llama' ? 52 : 40);
    return this.sprite(sp, f, x, y, flip, opts.alpha ?? 1);
  }

  // ─── the iso floor ───
  private tile(name: 'tile-move' | 'tile-attack' | 'tile-grid', m: MapDef, x: number, y: number, alpha: number) {
    const im = this.img[name]; if (!im?.complete || !im.naturalWidth) return;
    const p = tileCenter(m, x, y);
    this.c.save(); this.c.globalAlpha = alpha; this.c.drawImage(im, p.x - TW / 2, p.y - TH / 2, TW, TH); this.c.restore();
  }
  private text(s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center') {
    const c = this.c; c.save();
    c.font = `700 ${size}px Alegreya, Georgia, serif`; c.textAlign = align; c.textBaseline = 'middle';
    c.lineWidth = Math.max(3, size / 5); c.strokeStyle = 'rgba(40,18,10,.9)'; c.lineJoin = 'round';
    c.strokeText(s, x, y); c.fillStyle = color; c.fillText(s, x, y); c.restore();
  }
  private bg(name: string, dim = 0) {
    const im = this.img[name]; const c = this.c;
    if (im?.complete && im.naturalWidth) c.drawImage(im, 0, 0, VIEW_W, VIEW_H); else { c.fillStyle = '#e9d9c8'; c.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (dim) { c.fillStyle = `rgba(20,10,8,${dim})`; c.fillRect(0, 0, VIEW_W, VIEW_H); }
  }

  // ─── a frame ───
  draw(g: SaltGame, dt: number, ui: SceneUi) {
    this.now += dt;
    this.boxes = [];
    const talk = g.talk ? TALK[g.talk.id] : null;
    if (talk && g.talk!.id !== this.lastTalk) {
      this.lastTalk = g.talk!.id;
      const la = LINE_ACT[g.talk!.id];
      if (la) this.play(la[0], la[1]);
    }
    if (!talk) this.lastTalk = '';
    if (g.mode === 'travel' || (g.mode === 'talk' && g.talk?.back === 'travel')) {
      if (talk?.art) this.bg(talk.art); else this.drawMap(g);
    } else if (g.mode === 'combat') { this.updateFight(g, dt); this.drawFight(g, ui); }
    else this.drawPlace(g, ui);
    this.drawFloats(dt, g.place);
  }

  private drawPlace(g: SaltGame, ui: SceneUi) {
    const m = MAPS[g.place];
    this.bg(g.place === 'town' ? 'bg-town' : 'bg-yard');
    // where the click would go, and where the party is heading
    if (g.mode === 'explore' && ui.hover) {
      const [hx, hy] = ui.hover;
      if (g.open(hx, hy)) this.tile('tile-grid', m, hx, hy, 0.75);
    }
    if (g.mode === 'explore' && g.path.length) { const [ex, ey] = g.path[g.path.length - 1]; this.tile('tile-move', m, ex, ey, 0.55); }
    const draws: { y: number; f: () => void }[] = [];
    const speaking = g.mode === 'talk' ? g.talk?.speaker : null;
    for (const n of g.npcs()) {
      const p = tileCenter(m, n.x, n.y);
      draws.push({ y: p.y, f: () => {
        const one = this.acting(n.id);
        let b;
        if (n.sprite === 'fox') {
          const beaten = g.mode === 'talk' && g.talk?.id === 'tika.beaten';
          b = this.figure(n.id, 'fox', p.x, p.y, n.flip ? 'fl' : 'fr', { down: beaten, talking: speaking === 'tika' && n.id === 'tika' || speaking === n.id });
        } else {
          const sp = n.sprite;
          let act = 'idle', t = this.now + hash(n.id) * 4, fps = 1.3, once = false;
          if (one) { act = one.act; t = this.now - one.t0; fps = FRAMES[sp][act].length / one.dur; once = true; }
          else if (speaking === n.id) { act = 'talk'; fps = 2.5; }
          this.shadow(p.x, p.y, 40);
          b = this.sprite(sp, this.frameOf(sp, act, t, fps, once), p.x, p.y, !!n.flip);
        }
        if (b) this.boxes.push({ kind: 'npc', id: n.id, ...b });
      } });
    }
    if (g.place === 'town') for (const [i, pair] of LLAMAS.entries()) draws.push(this.llama(m, i, pair));
    for (const s of g.spots()) { const p = tileCenter(m, s.x, s.y); this.boxes.push({ kind: 'spot', id: s.id, x0: p.x - 70, y0: p.y - 110, x1: p.x + 70, y1: p.y + 30 }); }
    for (const h of ['dora', 'enzo'] as const) {
      const w = g.party[h];
      const fx = w.fx + (w.x - w.fx) * w.t, fy = w.fy + (w.y - w.fy) * w.t;
      const p = tileCenter(m, fx, fy);
      draws.push({ y: p.y + 0.1, f: () => {
        let act: string | null = null;
        if (g.mode === 'finding') act = h === 'enzo' ? (g.findT > FIND_TIME - 0.9 ? 'triumph' : 'crank') : (g.findT > 1.2 ? 'cheer' : 'idle');
        const talking = g.mode === 'talk' && g.said?.who === h;
        this.figure(h, h, p.x, p.y, w.dir, { walking: w.moving && w.t < 1, talking, act });
      } });
    }
    draws.sort((a, b) => a.y - b.y).forEach((d) => d.f());
    // the spot names, faintly, when hovered
    if (g.mode === 'explore') for (const s of g.spots()) {
      const p = tileCenter(m, s.x, s.y), box = this.boxes.find((b) => b.kind === 'spot' && b.id === s.id)!;
      if (ui.px >= box.x0 && ui.px <= box.x1 && ui.py >= box.y0 && ui.py <= box.y1) this.text(s.name, p.x, p.y - 120, 26, '#fff3d6');
    }
    if (g.mode === 'explore') for (const b of this.boxes) {
      if (b.kind !== 'npc') continue;
      if (ui.px >= b.x0 && ui.px <= b.x1 && ui.py >= b.y0 && ui.py <= b.y1) { const n = g.npcs().find((q) => q.id === b.id)!; this.text(n.name, (b.x0 + b.x1) / 2, b.y0 - 6, 26, '#fff3d6'); break; }
    }
  }
  /** a pack llama pacing between two tiles: stand, walk over, graze, walk back */
  private llama(m: MapDef, i: number, pair: [number, number][]) {
    const T = 9, t = (this.now + i * 3.7) % T;
    const a = tileCenter(m, pair[0][0], pair[0][1]), b = tileCenter(m, pair[1][0], pair[1][1]);
    let x = a.x, y = a.y, act = 'idle', flip = b.x < a.x;
    if (t < 3) act = 'idle';
    else if (t < 4.5) { const k = (t - 3) / 1.5; x = a.x + (b.x - a.x) * k; y = a.y + (b.y - a.y) * k; act = 'walk'; }
    else if (t < 7.5) { x = b.x; y = b.y; act = 'graze'; }
    else { const k = (t - 7.5) / 1.5; x = b.x + (a.x - b.x) * k; y = b.y + (a.y - b.y) * k; act = 'walk'; flip = !flip; }
    return { y, f: () => { this.shadow(x, y, 52); this.sprite('llama', this.frameOf('llama', act, t, act === 'walk' ? 6 : 1), x, y, flip); } };
  }

  private drawFight(g: SaltGame, ui: SceneUi) {
    const m = MAPS.yard, c = g.combat!;
    this.bg('bg-yard');
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.rows[y][x] === 'f') this.tile('tile-grid', m, x, y, 0.22);
    const cur = g.current();
    const idle = !this.busy();
    const hover = ui.hover;
    if (cur && cur.side === 'hero' && idle && !c.over) {
      const reach = g.reach(cur);
      if (ui.aim === 'act') for (const k of reach.keys()) { const [x, y] = k.split(',').map(Number); this.tile('tile-move', m, x, y, ui.help ? 0.5 : 0.3); }
      if (hover && ui.aim === 'act') {
        const p = reach.get(`${hover[0]},${hover[1]}`);
        if (p) for (const [x, y] of p) this.tile('tile-move', m, x, y, 0.95);
      }
      this.tile('tile-move', m, cur.x, cur.y, 0.9);
      for (const f of c.units) {
        if (ui.aim === 'act' && f.side === 'foe' && !f.down && g.hitChance(cur, f) > 0 && cur.ap >= g.attackCost(cur)) this.tile('tile-attack', m, f.x, f.y, 0.65);
        if (ui.aim === 'mend' && g.canMend(f)) this.tile('tile-move', m, f.x, f.y, 1);
      }
    }
    const draws: { y: number; f: () => void }[] = [];
    for (const u of c.units) {
      const d = this.disp.get(u.id) ?? { x: u.x, y: u.y, path: [], seg: 0, walking: false };
      let fx = d.x, fy = d.y;
      if (d.walking && d.path.length) { fx += (d.path[0][0] - d.x) * d.seg; fy += (d.path[0][1] - d.y) * d.seg; }
      const p = tileCenter(m, fx, fy);
      const dir = d.walking && d.path.length ? stepDir(d, u.dir) : u.dir;
      const sp: SpriteId = u.side === 'foe' ? 'fox' : (u.id as SpriteId);
      draws.push({ y: p.y, f: () => {
        const downShown = u.down && !(this.cur?.ev.k === 'attack' && (this.cur.ev as { target: string }).target === u.id && !this.cur.fired) && !this.queueHas('down', u.id);
        const b = this.figure(u.id, sp, p.x, p.y, dir, { walking: d.walking, down: downShown, alpha: u.fled ? 0 : 1 });
        if (b) this.boxes.push({ kind: 'unit', id: u.id, ...b });
      } });
    }
    draws.sort((a, b) => a.y - b.y).forEach((d) => d.f());
    // the odds over each Runner in reach, and the brackets on the one under the pointer
    if (cur && cur.side === 'hero' && idle && !c.over && ui.aim === 'act') {
      for (const f of c.units) {
        if (f.side !== 'foe' || f.down) continue;
        const ch = g.hitChance(cur, f);
        if (ch <= 0 || cur.ap < g.attackCost(cur)) continue;
        const b = this.boxes.find((q) => q.id === f.id);
        if (!b) continue;
        const over = ui.px >= b.x0 && ui.px <= b.x1 && ui.py >= b.y0 && ui.py <= b.y1;
        if (over) this.brackets(b);
        if (ui.help || over) this.tag(`Hit ${ch}%`, (b.x0 + b.x1) / 2, Math.max(150, b.y0 - 18));
      }
    }
    if (cur && cur.side === 'hero' && idle && !c.over && ui.aim === 'mend') {
      for (const h of c.units) if (g.canMend(h)) { const b = this.boxes.find((q) => q.id === h.id); if (b) { this.brackets(b); this.tag(`Mend +${Math.min(5, h.max - h.hp)}`, (b.x0 + b.x1) / 2, b.y0 - 18); } }
    }
    // health over everyone in the fight
    for (const u of c.units) {
      if (u.fled) continue;
      const b = this.boxes.find((q) => q.id === u.id); if (!b) continue;
      const w = 64, x = (b.x0 + b.x1) / 2 - w / 2, y = b.y1 + 2;
      const k = this.c; k.save(); k.fillStyle = 'rgba(30,14,8,.75)'; k.fillRect(x - 2, y - 2, w + 4, 10);
      k.fillStyle = u.side === 'hero' ? '#4fd8c4' : '#e0703c'; k.fillRect(x, y, w * Math.max(0, u.hp) / u.max, 6); k.restore();
    }
  }
  private queueHas(k: string, id: string) { return this.queue.some((e) => e.k === k && (e as { id: string }).id === id); }
  private brackets(b: { x0: number; y0: number; x1: number; y1: number }) {
    const im = this.img['ui-brackets']; if (!im?.complete || !im.naturalWidth) return;
    const pad = 8; this.c.drawImage(im, b.x0 - pad, b.y0 + 10, b.x1 - b.x0 + pad * 2, b.y1 - b.y0);
  }
  private tag(s: string, x: number, y: number) {
    const im = this.img['ui-tag']; const w = 128, h = 46;
    if (im?.complete && im.naturalWidth) this.c.drawImage(im, x - w / 2, y - h, w, h);
    this.text(s, x, y - h / 2 - 3, 22, '#fff1d0');
  }
  private drawFloats(dt: number, place: Place) {
    const m = MAPS[place];
    this.floats = this.floats.filter((f) => (f.t += dt) < 1.4);
    for (const f of this.floats) {
      const p = tileCenter(m, f.x, f.y);
      this.c.save(); this.c.globalAlpha = Math.min(1, 2.4 - f.t * 1.7);
      this.text(f.text, p.x, p.y - 170 - f.t * 40, 34, f.color); this.c.restore();
    }
  }

  private drawMap(g: SaltGame) {
    this.bg('bg-map');
    const at = (n: NodeId) => ({ x: MAP_NODES[n].x * VIEW_W, y: MAP_NODES[n].y * VIEW_H });
    const legs: [NodeId, NodeId][] = [['tunupa', 'lagoon'], ['lagoon', 'coipa'], ['tunupa', 'isle1'], ['isle1', 'isle2'], ['isle2', 'coipa']];
    void legs;
    for (const n of Object.keys(MAP_NODES) as NodeId[]) {
      const p = at(n), lit = g.visited.includes(n);
      const im = this.img[lit ? 'ui-pip' : 'ui-pip-empty'];
      if (im?.complete && im.naturalWidth) this.c.drawImage(im, p.x - 22, p.y - 22, 44, 44);
      this.text(MAP_NODES[n].name, p.x, p.y + 38, 24, lit ? '#fff3d6' : '#f3e2c8');
    }
    // the party: walking between stops, or waiting at one
    let x: number, y: number, walking = false, flip = false;
    if (g.journey) {
      const a = at(g.journey.from), b = at(g.journey.to), k = g.journey.t;
      x = a.x + (b.x - a.x) * k; y = a.y + (b.y - a.y) * k; walking = true; flip = b.x < a.x;
    } else { const p = at(g.at); x = p.x; y = p.y; }
    const t = this.now;
    const back = g.journey ? at(g.journey.to).y < at(g.journey.from).y : false;
    const act = walking ? (back ? 'backWalk' : 'walk') : 'idle';
    const fd = this.frameOf('dora', act, t, walking ? 9 : 1.4), fe = this.frameOf('enzo', act, t + 0.3, walking ? 9 : 1.4);
    const fl = back ? !flip : flip;
    this.sprite('enzo', fe, x + 18, y - 4, fl, 1, 0.5);
    this.sprite('dora', fd, x - 14, y + 2, fl, 1, 0.5);
    void LEG_TIME;
  }

  tileAt(g: SaltGame, px: number, py: number) { return screenTile(MAPS[g.mode === 'combat' ? 'yard' : g.place], px, py); }
  /** what's under the pointer: a figure (topmost), a spot, else the tile */
  pick(g: SaltGame, px: number, py: number): Pick | null {
    const m = MAPS[g.place === 'yard' || g.mode === 'combat' ? 'yard' : g.place];
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (b.kind === 'spot') continue;
      // figures are picked on their middle, not the empty corners of their painting
      const w = b.x1 - b.x0, h = b.y1 - b.y0;
      if (px >= b.x0 + w * 0.2 && px <= b.x1 - w * 0.2 && py >= b.y0 + h * 0.1 && py <= b.y1) {
        if (b.kind === 'unit') { const u = g.unit(b.id)!; return { kind: 'unit', id: b.id, x: u.x, y: u.y }; }
        const n = g.npcs().find((q) => q.id === b.id)!; return { kind: 'npc', id: b.id, x: n.x, y: n.y };
      }
    }
    for (const b of this.boxes) if (b.kind === 'spot' && px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1) { const s = g.spots().find((q) => q.id === b.id)!; return { kind: 'spot', id: s.id, x: s.x, y: s.y }; }
    const [x, y] = screenTile(m, px, py);
    return { kind: 'tile', id: '', x, y };
  }
}

function stepDir(d: { x: number; y: number; path: [number, number][] }, was: Dir): Dir {
  const [nx, ny] = d.path[0], dx = nx - d.x, dy = ny - d.y;
  if (dx > 0) return 'fr'; if (dy > 0) return 'fl'; if (dx < 0) return 'bl'; if (dy < 0) return 'br'; return was;
}
export type { Unit };
