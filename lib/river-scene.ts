import type { Hero, Pose, RiverGame } from './river-game.js';
import { TILE } from './river-world.js';

const ROOT = '/art/river';
type Art = Record<string, HTMLImageElement>;
const atlases = ['dora', 'enzo', 'props', 'effects', ...Array.from({ length: 6 }, (_, i) => `tiles-${i}`),
  ...Array.from({ length: 4 }, (_, i) => `foes-${i}`), ...Array.from({ length: 6 }, (_, i) => `boss-${i}`)];
const landscape = ['cover', ...Array.from({ length: 6 }, (_, i) => `view-${i}`), ...Array.from({ length: 6 }, (_, i) => `surface-${i}`)];
const poses: Record<Pose, number> = {
  idle: 0, run: 1, jump: 3, land: 4, climb: 5, hurt: 6, use: 7,
  brace: 8, shove: 9, wade: 10, recover: 11, victory: 12, walk: 13, reach: 14,
};

export async function loadRiverArt(): Promise<Art> {
  const load = (name: string, ext: string) => new Promise<[string, HTMLImageElement]>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve([name, image]);
    image.onerror = () => reject(new Error(name));
    image.src = `${ROOT}/${name}.${ext}`;
  });
  return Object.fromEntries(await Promise.all([...atlases.map(name => load(name, 'png')), ...landscape.map(name => load(name, 'webp'))]));
}
function tile(ctx: CanvasRenderingContext2D, art: HTMLImageElement, frame: number, x: number, y: number) {
  ctx.drawImage(art, frame % 4 * 24, Math.floor(frame / 4) * 24, 24, 24, x, y, TILE, TILE);
}
function sprite(ctx: CanvasRenderingContext2D, art: HTMLImageElement, frame: number, cols: number, cell: number,
  x: number, y: number, size: number, face = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (face < 0) ctx.scale(-1, 1);
  ctx.drawImage(art, frame % cols * cell, Math.floor(frame / cols) * cell, cell, cell, -size / 2, -size + 2, size, size);
  ctx.restore();
}
export class RiverScene {
  private x = 0;
  private y = 0;
  private room = '';
  constructor(private readonly art: Art) {}

  draw(canvas: HTMLCanvasElement, game: RiverGame, reducedMotion = false) {
    const c = canvas.getContext('2d');
    if (!c) return;
    c.imageSmoothingEnabled = false;
    const { width, height } = canvas;
    const area = game.room.district, scenery = this.art[`view-${area}`];
    const worldWidth = game.room.width * TILE, worldHeight = game.room.height * TILE;
    const clamp = (value: number, span: number, screen: number) => span <= screen ? (span - screen) / 2 : Math.max(0, Math.min(span - screen, value));
    const targetX = clamp(game.player.x - width * .47, worldWidth, width);
    const targetY = clamp(game.player.y - height * .51, worldHeight, height);
    if (this.room !== game.room.id) { this.room = game.room.id; this.x = targetX; this.y = targetY; }
    this.x += (targetX - this.x) * .18;
    this.y += (targetY - this.y) * .18;
    const hit = game.events.findLast(e => e.kind === 'hurt' || e.kind === 'stake');
    const shake = !reducedMotion && hit && game.tick - hit.tick < 9 ? (game.tick % 2 ? 2 : -2) : 0;
    const ox = Math.round(this.x + shake), oy = Math.round(this.y);
    const layers = this.art[`tiles-${area}`], material = this.art[`surface-${area}`];
    const paintSurface = (id: number, col: number, row: number) => {
      const span = 160 / TILE;
      const sx = id % 2 * 160 + ((col % span + span) % span) * TILE;
      const sy = Math.floor(id / 2) * 160 + ((row % span + span) % span) * TILE;
      c.drawImage(material, sx, sy, TILE, TILE, col * TILE, row * TILE, TILE, TILE);
    };
    c.drawImage(scenery, Math.max(0, this.x * .022), 0, scenery.width - 26, scenery.height, 0, 0, width, height);
    c.save();
    c.translate(-ox, -oy);
    for (let row = Math.floor(oy / TILE); row < Math.ceil((oy + height) / TILE); row++) {
      for (let col = Math.floor(ox / TILE); col < Math.ceil((ox + width) / TILE); col++) {
        if (row < -1 || row > game.room.height || col < -1 || col > game.room.width) continue;
        const s = game.surface(col, row), x = col * TILE, y = row * TILE;
        const variation = ((col * 19 + row * 37) % 7) === 0;
        const exterior = row < 0 || row >= game.room.height || col < 0 || col >= game.room.width;
        const land = exterior ? 10 : s.tile === '#' ? 2 : s.tile === '+' ? 3 : s.tile === ';' ? 10 : s.tile === '=' ? 8 :
          s.tile === ':' || s.tile === 'X' ? 9 : variation ? 1 : 0;
        if ('+=:X'.includes(s.tile)) tile(c, layers, land, x, y);
        else if (s.solid && game.surface(col, row + 1).solid && !exterior) paintSurface(2, col, row);
        else if (s.solid && !exterior) tile(c, layers, land, x, y);
        else paintSurface(s.tile === ';' || exterior ? 3 : 0, col, row);
        if (s.depth < .48 && !s.solid && game.surface(col, row + 1).depth >= .48) {
          c.drawImage(layers, 75, 51, 17, 19, x, y + 15, TILE, 5);
        }
        if (s.depth) {
          c.globalAlpha = s.depth < .48 ? s.depth + .3 : Math.min(1, s.depth + .12);
          const fast = Math.hypot(s.flow.x, s.flow.y) > .78;
          const cycle = (game.tick >> 4) + col * 3 + row;
          paintSurface(1, col, row);
          c.globalAlpha = 1;
          if (s.depth >= .48 && fast && cycle % 11 === 0) {
            c.save();
            c.translate(x + 10, y + 11);
            c.rotate(Math.atan2(s.flow.y, s.flow.x));
            sprite(c, this.art.effects, 1, 4, 72, 0, 6, 25);
            c.restore();
          }
        }
      }
    }

    const draw: { y: number; paint: () => void }[] = [];
    const add = (y: number, paint: () => void) => draw.push({ y, paint });
    const props = this.art.props, effects = this.art.effects;
    const guide = game.options.assist && !game.clear ? game.prompt()?.at : undefined;
    if (guide) {
      c.globalAlpha = .62 + Math.sin(game.tick / 16) * .18;
      sprite(c, effects, 10, 4, 72, guide.x, guide.y + 13, 36);
      c.globalAlpha = 1;
    }
    const prop = (frame: number, x: number, y: number, size: number) => sprite(c, props, frame, 4, 64, x, y, size);
    for (let row = 1; row < game.room.height - 1; row++) for (let col = 1; col < game.room.width - 1; col++) {
      if (game.tileAt(col, row) !== ';' || (row * 17 + col * 7) % 4 === 0) continue;
      const x = col * TILE + 10, y = row * TILE + 16;
      if (x < ox - 38 || x > ox + width + 38 || y < oy - 38 || y > oy + height + 38) continue;
      add(y, () => prop(12, x, y, 21 + (col % 3) * 3));
    }
    for (const mark of game.room.markers) {
      const { type, x, y } = mark;
      if ('gjq'.includes(type)) add(y, () => prop(game.gates[type === 'g' ? 0 : 1] ? 1 : 0, x, y + 4, 32));
      if (type === 'T' || type === 'V') add(y, () => {
        if (game.water[type === 'T' ? 1 : 3] > .72) sprite(c, effects, 8, 4, 72, x, y + 8, 23);
      });
      if (type === 'k' && !game.weight) add(y, () => prop(10, x, y + 4, 31));
      if ('Jmo'.includes(type)) add(y, () => prop(2, x, y + 6, type === 'm' ? 27 : 22));
      if (type === 'O') add(y, () => {
        prop(5, x, y + 5, 46);
        if (game.wheel && game.tick % 32 < 18) sprite(c, effects, 2, 4, 72, x, y + 10, 23);
      });
      if (type === 'X') add(y, () => prop(game.exitReady ? 7 : 6, x, y + 9, 38));
      if (type === 'H') add(y, () => prop(13, x, y + 7, 32));
      if (type === 's' || type === 'S') {
        if (!game.save.marks.includes(game.room.id)) add(y, () => prop(4, x, y + 4, 24));
      }
      if ('uw'.includes(type)) {
        const live = game.arena?.phase === (type === 'u' ? 0 : 1);
        add(y, () => {
          prop(15, x, y + 6, 25);
          if (live && game.arena?.primed) sprite(c, effects, 10, 4, 72, x, y + 10, game.beat === 'open' ? 38 : 29);
        });
      }
      if (type === 'D' && area === 3) add(y - 20, () => prop(9, x - 13, y - 20, 27));
    }
    if (game.arena && game.arena.phase < 2) {
      const boss = game.bossPosition();
      const frame = game.beat === 'guard' ? 0 : game.beat === 'tell' ? 1 : game.beat === 'strike' ? 2 : 3;
      if (game.beat === 'tell' || game.beat === 'strike') {
        const hazard = game.strike();
        const frame = hazard.kind === 'ring' || game.beat === 'tell' ? 7 : hazard.kind === 'wake' ? 1 : 3;
        c.save();
        c.translate(hazard.x, hazard.y);
        c.scale(1, hazard.height / hazard.width);
        sprite(c, effects, frame, 4, 72, 0, hazard.width * .4, hazard.width + 14);
        c.restore();
      }
      add(boss.y, () => sprite(c, this.art[`boss-${area}`], frame, 2, 112, boss.x, boss.y + 11, 100));
    }
    for (const foe of game.foes) {
      const frame = foe.stunned ? 0 : foe.action || ((game.tick + foe.phase) % 30 < 13 ? 1 : 0);
      add(foe.y, () => {
        sprite(c, this.art[`foes-${Math.floor(foe.kind / 3)}`], foe.kind % 3 * 4 + frame, 4, 42, foe.x, foe.y + 5, 34, foe.face);
        if (frame === 2 || foe.stunned) sprite(c, effects, foe.stunned ? 5 : 7, 4, 72, foe.x, foe.y - 12, 22);
      });
    }
    const boat = game.boat;
    if (boat.aboard) {
      add(boat.y - 1, () => {
        if (Math.hypot(boat.vx, boat.vy) > .3) sprite(c, effects, 1, 4, 72, boat.x, boat.y + 16, 63, game.heroes.enzo.face);
        sprite(c, props, 3, 4, 64, boat.x, boat.y + 12, 65, game.heroes.enzo.face);
      });
    } else {
      add(boat.y - 1, () => prop(3, boat.x - 4, boat.y + 11, 49));
    }
    for (const hero of ['dora', 'enzo'] as Hero[]) {
      const r = game.heroes[hero], afloat = hero === 'enzo' && boat.aboard;
      const rider = hero === 'dora' && boat.aboard && boat.passenger;
      const jumping = r.air && !reducedMotion ? 13 * Math.sin(r.air / 26 * Math.PI) : 0;
      let frame = poses[r.pose];
      if (r.pose === 'run') frame = game.tick % 18 < 9 ? 1 : 2;
      if (afloat && r.pose === 'run') frame = game.tick % 26 < 13 ? 8 : 9;
      if (afloat && r.pose === 'brace') frame = 10;
      if (afloat && r.pose === 'use') frame = 11;
      if (r.pose === 'idle' && game.tick % 98 >= 86 && !afloat) frame = 13;
      add(r.y, () => {
        if (hero === game.lead) sprite(c, effects, 10, 4, 72, r.x, r.y + 9, 32);
        sprite(c, this.art[hero], frame, 4, 60, r.x - (rider ? 13 * game.heroes.enzo.face : 0), r.y + 6 - jumping - (afloat || rider ? 5 : 0), 53, r.face);
      });
    }
    draw.sort((a, b) => a.y - b.y).forEach(item => item.paint());
    for (const e of game.events) {
      const age = game.tick - e.tick;
      const frame = e.kind === 'hurt' ? 6 : e.kind === 'mark' ? 5 : e.kind === 'clear' ? 11 :
        e.kind === 'jump' ? 4 : e.kind === 'launch' || e.kind === 'moor' ? 2 : e.kind === 'gate' ? 8 : e.kind === 'stake' ? 3 : 10;
      if (age < 28) {
        c.globalAlpha = 1 - age / 32;
        sprite(c, effects, frame, 4, 72, e.x, e.y + 6, 35 + age * .75);
        c.globalAlpha = 1;
      }
    }
    c.restore();

    if (area === 3 || area === 5) {
      const light = c.createRadialGradient(game.player.x - ox, game.player.y - oy, 55, game.player.x - ox, game.player.y - oy, width * .62);
      light.addColorStop(0, '#0f162400');
      light.addColorStop(1, area === 3 ? '#18102d45' : '#32324d27');
      c.fillStyle = light;
      c.fillRect(0, 0, width, height);
    }
  }
}
