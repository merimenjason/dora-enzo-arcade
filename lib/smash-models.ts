// Fluffball Smash! models: Dora and Enzo are Grumble Hunt's toon chinchillas in tennis kit; the six rivals are built
// here from the same parts (a rig with a body, head, ears, feet, two arms and a tail, so the same animation and arm
// posing drive everyone), plus the racket. +x is forward in every rig.
import * as T from 'three';
import { animateHuntChinchilla, createHuntChinchilla, poseArms, type HuntChinchilla } from './hunt-chinchilla';
import type { CharId } from './smash-game';

const ramp = new T.DataTexture(new Uint8Array([96, 178, 255]), 3, 1, T.RedFormat);
ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
export const toon = (color: number, o: T.MeshToonMaterialParameters = {}) => new T.MeshToonMaterial({ color, gradientMap: ramp, ...o });
const flat = (color: number) => { const m = new T.MeshBasicMaterial({ color }); m.userData.outlineParameters = { visible: false }; return m; };
const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const SPH = new T.SphereGeometry(1, 20, 14);

export type Rig = HuntChinchilla & { racket: T.Group; pivot: T.Group; hand: 1 | -1; height: number };

function add(p: T.Object3D, g: T.BufferGeometry, m: T.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  const o = new T.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; p.add(o); return o;
}
/** a band of cloth round a sphere, between two latitudes (0 at the top, PI at the bottom) */
const band = (a: number, b: number) => new T.SphereGeometry(1, 24, 10, 0, Math.PI * 2, a, b - a);

// ---------------------------------------------------------------- the racket
export function buildRacket(frame: number, grip: number) {
  const g = new T.Group(), fm = toon(frame), gm = toon(grip);
  // the handle runs along +y from the grip; the head sits at the top
  add(g, new T.CylinderGeometry(0.03, 0.034, 0.3, 10), gm, 0, 0.05, 0);
  add(g, new T.CylinderGeometry(0.02, 0.02, 0.2, 8), fm, -0.05, 0.27, 0).rotation.z = 0.3;
  add(g, new T.CylinderGeometry(0.02, 0.02, 0.2, 8), fm, 0.05, 0.27, 0).rotation.z = -0.3;
  const head = add(g, new T.TorusGeometry(0.19, 0.022, 8, 28), fm, 0, 0.55, 0, 0.82, 1.08, 1);
  head.rotation.y = 0;
  // strings: a see-through grid
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!;
  x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 2; for (let i = 4; i < 64; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.moveTo(0, i); x.lineTo(64, i); x.stroke(); }
  const tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(2, 2);
  const strings = new T.Mesh(new T.CircleGeometry(0.18, 24), new T.MeshBasicMaterial({ map: tex, transparent: true, side: T.DoubleSide, depthWrite: false }));
  strings.position.set(0, 0.55, 0); strings.scale.set(0.82, 1.08, 1); strings.rotation.y = Math.PI / 2; strings.userData.outlineParameters = { visible: false };
  // the head is in the y-z plane so it faces along x when the handle points up
  head.rotation.y = Math.PI / 2;
  g.add(strings);
  return g;
}

// ---------------------------------------------------------------- the rivals
type Look = {
  fur: number; belly: number; size: number;
  ears: 'long' | 'round' | 'none' | 'small'; earIn: number;
  snout: 'muzzle' | 'beak' | 'turtle' | 'panda'; eye: number;
  tail: 'puff' | 'long' | 'ringed' | 'none' | 'stub'; tailTip?: number;
  shirt: number; shirt2?: number; skirt?: number;
  extra?: (r: { head: T.Group; body: T.Group; root: T.Group }) => void;
};
const LOOKS: Record<Exclude<CharId, 'dora' | 'enzo'>, Look> = {
  bramble: { fur: 0x9b6a42, belly: 0xefdcc0, size: 1.05, ears: 'long', earIn: 0xe9a99a, snout: 'muzzle', eye: 0x7a4410, tail: 'puff', shirt: 0x3f9a4a,
    extra: ({ head }) => { add(head, new T.TorusGeometry(0.4, 0.05, 8, 24), toon(0xffffff), -0.02, 0.16, 0, 1, 1, 1).rotation.set(Math.PI / 2, 0, 0.25); } },
  sable: { fur: 0x5c3a26, belly: 0xf2e2c8, size: 0.95, ears: 'small', earIn: 0xd9a090, snout: 'muzzle', eye: 0x1a1210, tail: 'long', tailTip: 0x3a2418, shirt: 0x8a5cc4, skirt: 0x8a5cc4 },
  sorrel: { fur: 0x5c3a26, belly: 0xf2e2c8, size: 0.95, ears: 'small', earIn: 0xd9a090, snout: 'muzzle', eye: 0x1a1210, tail: 'long', tailTip: 0x3a2418, shirt: 0x6a3fa8, skirt: 0x6a3fa8 },
  gale: { fur: 0x1e1e26, belly: 0xf6f4ee, size: 1.08, ears: 'none', earIn: 0, snout: 'beak', eye: 0x1a1418, tail: 'stub', shirt: 0xf3f0e6, shirt2: 0x23336b,
    extra: ({ head }) => {
      const cap = new T.Group(); cap.position.set(-0.02, 0.3, 0); head.add(cap);
      add(cap, new T.CylinderGeometry(0.34, 0.38, 0.16, 20), toon(0x23336b), 0, 0.05, 0);
      add(cap, new T.CylinderGeometry(0.38, 0.38, 0.03, 20, 1, false, -Math.PI / 2, Math.PI), toon(0x111522), 0.12, -0.02, 0).scale.set(1.15, 1, 1);
      add(cap, SPH, toon(0xf3c94a), 0.33, 0.06, 0, 0.04, 0.04, 0.04);
    } },
  marlow: { fur: 0x8f9a5a, belly: 0xc8c48a, size: 1.0, ears: 'none', earIn: 0, snout: 'turtle', eye: 0x1a1418, tail: 'none', shirt: 0xf1e6cc,
    extra: ({ head, body }) => {
      shell(body);
      add(head, new T.ConeGeometry(0.16, 0.42, 12), toon(0xf4f2ec), 0.32, -0.3, 0).rotation.z = Math.PI + 0.25;
      const gm = toon(0x6b5a3a);
      for (const s of [-1, 1]) add(head, new T.TorusGeometry(0.08, 0.014, 6, 16), gm, 0.38, 0.06, s * 0.13).rotation.y = Math.PI / 2;
    } },
  fern: { fur: 0x93a25e, belly: 0xccc890, size: 0.98, ears: 'none', earIn: 0, snout: 'turtle', eye: 0x1a1418, tail: 'none', shirt: 0xf1e6cc, skirt: 0xf1e6cc,
    extra: ({ head, body }) => {
      shell(body);
      const hat = new T.Group(); hat.position.set(-0.04, 0.3, 0); head.add(hat);
      add(hat, new T.CylinderGeometry(0.62, 0.62, 0.03, 24), toon(0xe6c27a), 0, 0, 0);
      add(hat, new T.CylinderGeometry(0.28, 0.32, 0.22, 20), toon(0xe6c27a), 0, 0.11, 0);
      add(hat, new T.CylinderGeometry(0.33, 0.33, 0.06, 20), toon(0xd95a7a), 0, 0.04, 0);
      add(hat, SPH, toon(0xff8fb0), 0.2, 0.08, 0.25, 0.09, 0.09, 0.09);
    } },
  ember: { fur: 0xb8482a, belly: 0x3a2420, size: 1.0, ears: 'round', earIn: 0xf4efe6, snout: 'panda', eye: 0x8a5a10, tail: 'ringed', tailTip: 0x5a2416, shirt: 0x1c1a20, shirt2: 0xf06a1f },
  isolde: { fur: 0xdedfe3, belly: 0xf7f7f9, size: 1.1, ears: 'round', earIn: 0xc8c9d0, snout: 'muzzle', eye: 0x4aa8e0, tail: 'long', tailTip: 0x3a3a44, shirt: 0xf6f7fb, shirt2: 0xa9c6e8, skirt: 0xf6f7fb,
    extra: ({ head, body }) => {
      // rosettes: dark rings on the fur
      const m = toon(0x6a6a78);
      const spots: [T.Object3D, number, number, number][] = [[head, -0.12, 0.25, 0.25], [head, -0.2, 0.15, -0.28], [head, -0.3, -0.05, 0.2], [body, -0.3, 0.75, 0.38], [body, -0.42, 0.6, -0.36]];
      for (const [p, x, y, z] of spots) { const o = add(p, new T.TorusGeometry(0.05, 0.016, 6, 12), m, x, y, z); o.lookAt(o.position.clone().multiplyScalar(3)); }
    } },
};
function shell(body: T.Group) {
  const m = toon(0x7a5a32), rim = toon(0xa07a40);
  add(body, new T.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m, -0.32, 0.55, 0, 0.48, 0.62, 0.62).rotation.z = Math.PI / 2 + 0.15;
  add(body, new T.TorusGeometry(0.6, 0.05, 6, 24), rim, -0.3, 0.55, 0, 1, 1, 1).rotation.y = Math.PI / 2;
  // a few plates
  for (const [y, z] of [[0.8, 0], [0.55, 0.3], [0.55, -0.3], [0.32, 0]] as const) add(body, new T.CircleGeometry(0.13, 6), rim, -0.78, y, z).rotation.y = -Math.PI / 2;
}

export function buildRival(id: Exclude<CharId, 'dora' | 'enzo'>): HuntChinchilla {
  const L = LOOKS[id];
  const fur = toon(L.fur), belly = toon(L.belly), inner = toon(L.earIn || L.fur);
  const root = new T.Group(), body = new T.Group(), head = new T.Group(), tail = new T.Group();
  root.add(body);
  const ears: T.Group[] = [], feet: T.Group[] = [], arms: HuntChinchilla['arms'] = [], blink: T.Object3D[] = [];
  // body, belly patch and shirt
  add(body, SPH, fur, -0.06, 0.55, 0, 0.5, 0.55, 0.46);
  add(body, SPH, belly, 0.14, 0.5, 0, 0.36, 0.44, 0.36);
  add(body, band(Math.PI * 0.32, Math.PI * 0.78), toon(L.shirt), -0.06, 0.55, 0, 0.53, 0.58, 0.49);
  if (L.shirt2) add(body, band(Math.PI * 0.3, Math.PI * 0.4), toon(L.shirt2), -0.06, 0.56, 0, 0.545, 0.59, 0.5);
  if (L.skirt) add(body, new T.CylinderGeometry(0.42, 0.62, 0.3, 20, 1, true), toon(L.skirt, { side: T.DoubleSide }), -0.06, 0.28, 0);
  // head
  head.position.set(0.3, 1.08, 0); body.add(head);
  add(head, SPH, fur, 0, 0, 0, 0.42, 0.38, 0.42);
  if (L.snout === 'beak') {
    add(head, SPH, belly, 0.18, -0.02, 0, 0.3, 0.3, 0.34);
    const beak = add(head, new T.ConeGeometry(0.15, 0.36, 4), toon(0xf07a24), 0.5, -0.06, 0, 1, 1, 0.75); beak.rotation.z = -Math.PI / 2;
    add(head, new T.BoxGeometry(0.1, 0.05, 0.2), toon(0xd8a03a), 0.38, 0.02, 0);
  } else if (L.snout === 'turtle') {
    add(head, SPH, belly, 0.24, -0.1, 0, 0.22, 0.18, 0.28);
    add(head, SPH, toon(0x2a2420), 0.42, -0.02, 0, 0.03, 0.03, 0.08);
  } else if (L.snout === 'panda') {
    // white cheeks and brows, a dark nose
    for (const s of [-1, 1]) { add(head, SPH, toon(0xf4efe6), 0.22, -0.1, s * 0.2, 0.16, 0.12, 0.14); add(head, SPH, toon(0xf4efe6), 0.3, 0.18, s * 0.17, 0.06, 0.04, 0.07); }
    add(head, SPH, toon(0xf4efe6), 0.34, -0.12, 0, 0.12, 0.09, 0.12);
    add(head, SPH, toon(0x1a1210), 0.44, -0.06, 0, 0.05, 0.04, 0.06);
  } else {
    add(head, SPH, belly, 0.28, -0.1, 0, 0.18, 0.14, 0.2);
    add(head, SPH, toon(id === 'isolde' ? 0xd88a96 : 0x3a2420), 0.44, -0.04, 0, 0.05, 0.04, 0.06);
  }
  // eyes
  const iris = toon(L.eye), shine = flat(0xffffff);
  for (const s of [-1, 1]) {
    const eye = new T.Group(); eye.position.set(0.3, 0.08, s * 0.2); eye.rotation.y = s * -0.55; head.add(eye);
    add(eye, SPH, toon(0x15100e), 0, 0, 0, 0.06, 0.1, 0.08);
    add(eye, SPH, iris, 0.02, -0.01, 0, 0.05, 0.075, 0.06);
    add(eye, SPH, shine, 0.055, 0.035, -s * 0.015, 0.025, 0.025, 0.025);
    blink.push(eye);
    // ears
    const ear = new T.Group(); head.add(ear); ears.push(ear);
    if (L.ears === 'long') {
      ear.position.set(-0.08, 0.3, s * 0.15); ear.rotation.set(s * 0.18, 0, -0.15);
      add(ear, SPH, fur, 0, 0.4, 0, 0.1, 0.45, 0.07); add(ear, SPH, inner, 0.02, 0.4, 0, 0.06, 0.36, 0.06);
    } else if (L.ears === 'round') {
      ear.position.set(-0.04, 0.3, s * 0.27); ear.rotation.set(s * 0.4, 0, 0);
      add(ear, SPH, fur, 0, 0.06, 0, 0.13, 0.14, 0.05); add(ear, SPH, inner, 0.02, 0.06, 0, 0.09, 0.1, 0.04);
    } else if (L.ears === 'small') {
      ear.position.set(-0.04, 0.28, s * 0.25); ear.rotation.set(s * 0.45, 0, 0);
      add(ear, SPH, fur, 0, 0.04, 0, 0.09, 0.08, 0.04); add(ear, SPH, inner, 0.015, 0.04, 0, 0.06, 0.05, 0.03);
    }
    // feet
    const f = new T.Group(); f.position.set(-0.18, 0.05, s * 0.24); body.add(f);
    add(f, SPH, L.snout === 'beak' ? toon(0xf07a24) : fur, 0.06, 0.04, 0, 0.2, 0.08, 0.12);
    feet.push(f);
    // arms
    const limb = add(body, new T.CylinderGeometry(0.07, 0.075, 1, 10), L.snout === 'beak' ? fur : fur, 0, 0, 0);
    const paw = new T.Group(); body.add(paw); add(paw, SPH, fur, 0, 0, 0, 0.085, 0.085, 0.085);
    arms.push({ shoulder: V(0.24, 0.78, s * 0.36), rest: V(0.4, 0.5, s * 0.36), limb, paw });
  }
  // the mask of a ferret: a cream face with a dark band over the eyes
  if (id === 'sable' || id === 'sorrel') { add(head, SPH, belly, 0.2, -0.06, 0, 0.26, 0.24, 0.32); add(head, band(Math.PI * 0.38, Math.PI * 0.55), toon(0x3a2418), 0, 0, 0, 0.43, 0.39, 0.43); }
  // tail
  body.add(tail); tail.position.set(-0.5, 0.35, 0);
  if (L.tail === 'puff') add(tail, SPH, toon(0xf7f2ea), -0.04, 0.05, 0, 0.16, 0.16, 0.16);
  else if (L.tail === 'stub') add(tail, new T.ConeGeometry(0.12, 0.25, 8), fur, -0.06, 0, 0).rotation.z = Math.PI / 2;
  else if (L.tail === 'long' || L.tail === 'ringed') {
    const curve = new T.CatmullRomCurve3([V(0, 0, 0), V(-0.35, -0.05, 0), V(-0.65, 0.15, 0), V(-0.8, 0.5, 0)]);
    const tube = new T.TubeGeometry(curve, 40, L.tail === 'ringed' ? 0.12 : 0.085, 10, false);
    const col: number[] = [], c = new T.Color(), a = new T.Color(L.fur), b = new T.Color(L.tailTip ?? L.fur), w = new T.Color(0xf0d6b0);
    const n = tube.getAttribute('position').count;
    for (let i = 0; i < n; i++) {
      const t = Math.floor(i / 11) / 40;
      if (L.tail === 'ringed') c.copy(Math.floor(t * 9) % 2 ? w.clone().lerp(a, 0.3) : a);
      else c.copy(a).lerp(b, Math.max(0, (t - 0.6) / 0.4));
      col.push(c.r, c.g, c.b);
    }
    tube.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    add(tail, tube, toon(0xffffff, { vertexColors: true }), 0, 0, 0);
  }
  L.extra?.({ head, body, root });
  if (L.size !== 1) body.scale.setScalar(L.size);
  const rig: HuntChinchilla = { root, body, head, ears, feet, arms, tail, blink };
  poseArms(rig);
  return rig;
}

// ---------------------------------------------------------------- everyone, with a racket
const KIT: Record<'dora' | 'enzo', { shirt: number; trim: number; frame: number }> = { dora: { shirt: 0xe23a3a, trim: 0xffffff, frame: 0xd8262f }, enzo: { shirt: 0x24305e, trim: 0xffffff, frame: 0x2c5fb8 } };
const FRAMES: Partial<Record<CharId, number>> = { bramble: 0x2f7a3a, sable: 0x9a6ad8, sorrel: 0x7a4ac0, gale: 0x23336b, marlow: 0x8a6a3a, fern: 0x8a6a3a, ember: 0xf06a1f, isolde: 0xe8f2ff };

export function buildPlayer(id: CharId): Rig {
  let base: HuntChinchilla;
  if (id === 'dora' || id === 'enzo') {
    base = createHuntChinchilla(id === 'dora');
    const k = KIT[id];
    add(base.body, band(Math.PI * 0.34, Math.PI * 0.8), toon(k.shirt), -0.06, 0.52, 0, 0.585, 0.545, 0.525);
    add(base.body, band(Math.PI * 0.34, Math.PI * 0.4), toon(k.trim), -0.06, 0.525, 0, 0.59, 0.55, 0.53);
    if (id === 'dora') {
      // a red sweatband across the forehead, under the ears
      const b = add(base.head, new T.TorusGeometry(0.44, 0.05, 8, 28), toon(0xd8262f), -0.02, 0.14, 0, 1, 1, 1.02); b.rotation.set(Math.PI / 2, 0, 0.22);
      add(base.body, new T.CylinderGeometry(0.46, 0.6, 0.28, 20, 1, true), toon(0xffffff, { side: T.DoubleSide }), -0.06, 0.2, 0);
    } else {
      // a white visor between the ears
      const v = new T.Group(); v.position.set(0.02, 0.2, 0); base.head.add(v);
      add(v, new T.TorusGeometry(0.43, 0.04, 8, 28), toon(0xffffff), 0, 0, 0, 1, 1, 1).rotation.set(Math.PI / 2, 0, 0.2);
      add(v, new T.CylinderGeometry(0.46, 0.46, 0.025, 24, 1, false, -Math.PI / 2, Math.PI), toon(0xffffff), 0.14, -0.04, 0).scale.set(1.1, 1, 0.9);
    }
  } else base = buildRival(id);
  const hand: 1 | -1 = id === 'sorrel' ? -1 : 1;
  // the racket swings on a pivot at the hitting shoulder
  const pivot = new T.Group(); pivot.position.set(0.2, 0.72, hand * 0.3); base.body.add(pivot);
  const racket = buildRacket(id === 'dora' || id === 'enzo' ? KIT[id].frame : FRAMES[id] ?? 0x444444, 0x2a2420);
  racket.position.set(0, 0, hand * 0.55); racket.rotation.x = hand * Math.PI / 2; pivot.add(racket);
  const rig = base as Rig; rig.racket = racket; rig.pivot = pivot; rig.hand = hand; rig.height = 1.5;
  return rig;
}

const grip = new T.Vector3();
/**
 * Pose a player: running bob from the shared animation, then the racket. swing runs 0..1 through a stroke (or is
 * negative when ready and charging, with the racket drawn back); smash raises it overhead.
 */
export function posePlayer(r: Rig, time: number, speed: number, swing: number, kind: string, charging: boolean) {
  animateHuntChinchilla(r, time, speed, true);
  const h = r.hand, p = r.pivot;
  if (charging) {
    // drawn back and coiled, the racket trembling a little with power
    p.rotation.set(0, h * (1.9 + Math.sin(time * 40) * 0.03), kind === 'lob' ? -0.4 : 0.15);
  } else if (swing >= 0 && swing < 1) {
    const e = 1 - Math.pow(1 - swing, 3);
    if (kind === 'smash') p.rotation.set(0, h * (0.3 - e * 0.6), 1.7 - e * 2.9);
    else if (kind === 'slice' || kind === 'drop') p.rotation.set(0, h * (1.9 - e * 3.1), 0.5 - e * 0.9);
    else if (kind === 'lob') p.rotation.set(0, h * (1.6 - e * 2.6), -0.5 + e * 1.4);
    else p.rotation.set(0, h * (1.9 - e * 3.6), -0.25 + e * 0.9);
  } else {
    // ready position: racket out in front
    p.rotation.set(0, h * (0.5 + Math.sin(time * 2) * 0.04), 0.1);
  }
  // put the hitting paw on the grip
  r.root.updateMatrixWorld(true);
  r.racket.getWorldPosition(grip);
  r.body.worldToLocal(grip);
  if (h > 0) poseArms(r, null, grip, [0, 1]); else poseArms(r, grip, null, [1, 0]);
}
