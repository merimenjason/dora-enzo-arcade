// Overclock: which frame of a hero's strip shows each pose. Every action has its own drawing: the strips are 24 frames,
// sheet A (idle, run, jump, fall), sheet B (land, dash, the wall moves, hurt, victory, Enzo's hover and shield) and
// sheet C (shooting poses, tag-in, teleport, the hover-bike) and sheet D (teleport out, worn out, the power moves, a
// look back, a power shot). The strips are 32 frames. See scripts/overclock-art.py.
import type { HeroPose } from './overclock-game';

// the frame numbers in each hero's strip
const A = { idle: 0, idle2: 1, run: [2, 3, 4, 5], jump: 6, fall: 7 };
const DORA = {
  ...A, land: 8, dash: 9, cling: 10, climb: [11, 12], kick: 13, hurt: 14, victory: 15,
  shootStand: 16, shootRun: [17, 18], shootAir: 19, tagin: 20, teleport: 21, bike: 22, bikeup: 23,
  tout: 24, drill: 25, down: 26, moon: 27, look: 28, wave: 29, powerShot: 30, crouch: 31,
};
const ENZO = {
  ...A, land: 8, dash: 9, cling: 10, kick: 11, hover: 12, hurt: 13, victory: 14, shield: 15,
  shootStand: 16, charge: 17, shootRun: [18, 19], shootAir: 20, tagin: 21, teleport: 22, bike: 23,
  tout: 24, bikeup: 25, down: 26, stomp: 27, look: 28, wave: 29, powerShot: 30, crouch: 31,
};

/** the frame for a pose; `shooting` while the shot pose holds (a few frames after each shot) */
export function heroFrame(p: HeroPose): number {
  const shooting = p.shoot > 0;
  // now and then an idle hero glances back over their shoulder
  const idle = (F: { idle: number; idle2: number; look: number }, every: number) => Math.floor(p.t / 60) % 9 === 8 ? F.look : Math.floor(p.t / every) % 2 ? F.idle2 : F.idle;
  const cyc = (list: number[], every: number) => list[Math.floor(p.t / every) % list.length];
  if (p.id === 'dora') {
    const F = DORA;
    switch (p.st) {
      case 'tin': return F.teleport;
      case 'tout': return F.tout;
      case 'down': return F.down;
      case 'victory': return F.victory;
      case 'hurt': return F.hurt;
      case 'bike': return F.bike;
      case 'bikeup': return F.bikeup;
      case 'drill': return F.drill;
      case 'moon': return shooting ? F.shootAir : F.moon;
      case 'tagin': return F.tagin;
      case 'dash': return F.dash;
      case 'climb': return cyc(F.climb, 10);
      case 'cling': return F.cling;
      case 'kick': return F.kick;
      case 'jump': return shooting ? F.shootAir : F.jump;
      case 'fall': case 'hover': return shooting ? F.shootAir : F.fall;
      case 'land': return F.land;
      case 'run': return shooting ? cyc(F.shootRun, 7) : cyc(F.run, 6);
      default: return shooting ? (p.pw ? F.powerShot : F.shootStand) : idle(F, 40);
    }
  }
  const F = ENZO;
  switch (p.st) {
    case 'tin': return F.teleport;
    case 'tout': return F.tout;
    case 'down': return F.down;
    case 'victory': return F.victory;
    case 'hurt': return F.hurt;
    case 'bike': return F.bike;
    case 'bikeup': return F.bikeup;
    case 'stomp': return F.stomp;
    case 'drill': return F.dash;
    case 'tagin': return F.tagin;
    case 'shield': return F.shield;
    case 'dash': return F.dash;
    case 'climb': case 'cling': return F.cling;
    case 'kick': return F.kick;
    case 'hover': return F.hover;
    case 'jump': return shooting ? F.shootAir : F.jump;
    case 'fall': return shooting ? F.shootAir : F.fall;
    case 'land': return F.land;
    case 'charge': return F.charge;
    case 'run': return shooting ? cyc(F.shootRun, 7) : cyc(F.run, 7);
    default: return shooting ? (p.pw ? F.powerShot : F.shootStand) : idle(F, 44);
  }
}

/** every pose state the engine makes, for the tests: each must map to a frame of its own */
export const POSE_STATES = ['idle', 'run', 'jump', 'fall', 'land', 'dash', 'cling', 'climb', 'kick', 'hover', 'hurt', 'victory', 'shield', 'charge', 'tagin', 'tin', 'tout', 'bike', 'bikeup', 'drill', 'down', 'moon', 'stomp'];
/** the actions each hero really performs (Dora can't hover, shield, charge or stomp; Enzo can't climb, drill or moon-hop),
 *  plus the shooting variants, for the test that no two actions share a drawing */
export const HERO_ACTIONS: Record<'dora' | 'enzo', string[]> = {
  dora: ['idle', 'run', 'jump', 'fall', 'land', 'dash', 'cling', 'climb', 'kick', 'hurt', 'victory', 'tagin', 'tin', 'tout', 'bike', 'bikeup', 'drill', 'down', 'moon', 'shoot:idle', 'shoot:run', 'shoot:jump', 'power:idle'],
  enzo: ['idle', 'run', 'jump', 'fall', 'land', 'dash', 'cling', 'kick', 'hover', 'hurt', 'victory', 'shield', 'charge', 'tagin', 'tin', 'tout', 'bike', 'bikeup', 'down', 'stomp', 'shoot:idle', 'shoot:run', 'shoot:jump', 'power:idle'],
};
