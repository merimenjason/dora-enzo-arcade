// Cloudsteel: drawing only. Three.js on the WebGPU renderer (it falls back to WebGL 2 by itself): the rain-soaked
// terrace with a planar reflection, lantern bloom, the cloud-forest citadel around it, and Dora, Enzo and the foes
// as jointed figures posed from the fight's state. Every state has its own pose (idle, run, three cuts, guard,
// deflect, dodge, hit, recoil, broken, finisher, tag, fall, win; wind-ups and strikes per attack for the foes), and
// figures ease from one pose to the next. Rules in lib/cloudsteel-game.ts.
import * as T from 'three/webgpu';
import { pass, screenUV, smoothstep, float, vec2, reflector, mx_noise_float, positionWorld } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ARENA_R, CUTS, DODGE, FINISHER, TAG, type Fight, type FightEvent, type Foe } from './cloudsteel-game';

const PI = Math.PI, art = (n: string) => `/art/cloudsteel/${n}.webp`;
const mix = (a: number, b: number, k: number) => a + (b - a) * k, seg = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a))), ease = (s: number) => s * s * (3 - 2 * s), es = (t: number, a: number, b: number) => ease(seg(t, a, b));
const hdr = (r: number, g: number, b: number) => new T.Color().setRGB(r, g, b);
const std = (color: number, o: T.MeshStandardMaterialParameters = {}) => new T.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
const furM = (hex: number) => new T.MeshPhysicalMaterial({ color: hex, roughness: 0.95, sheen: 1, sheenRoughness: 0.45, sheenColor: new T.Color(hex).lerp(new T.Color(0xffffff), 0.55) });
const glowM = (c: T.ColorRepresentation) => new T.MeshBasicMaterial({ color: c, fog: false });
const box = (w: number, h: number, d: number) => new T.BoxGeometry(w, h, d), sph = (r: number) => new T.SphereGeometry(r, 24, 16), cyl = (a: number, b: number, h: number, n = 20) => new T.CylinderGeometry(a, b, h, n), cap = (r: number, l: number) => new T.CapsuleGeometry(r, l, 6, 14);
function mesh(geo: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0, parent?: T.Object3D) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent?.add(m); return m; }
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!, w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
function loadTex(n: string, repeat = 0) { const t = new T.TextureLoader().load(art(n)); t.colorSpace = T.SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); } return t; }

// ---------------------------------------------------------------- figures
/** a pose: every joint angle of a figure. Arms: 0 hangs down, -PI/2 points forward, -PI points up. */
type Pose = { y: number; lean: number; twist: number; ax: number; az: number; wr: number; bx: number; bz: number; ll: number; lr: number; head: number; tail: number; fall: number };
const POSE = (): Pose => ({ y: 0, lean: 0.08, twist: 0, ax: -1.05, az: -0.15, wr: 0.2, bx: 0.15, bz: 0.15, ll: 0, lr: 0, head: 0, tail: 0, fall: 0 });
const KEYS = Object.keys(POSE()) as (keyof Pose)[];
type Rig = { root: T.Group; body: T.Group; head: T.Group; tail: T.Group; armR: T.Group; armL: T.Group; hand: T.Group; legL: T.Group; legR: T.Group; hip: number; pose: Pose; tip: T.Object3D; extra?: Record<string, T.Object3D> };
function applyPose(r: Rig, to: Pose, k: number) {
  const p = r.pose; for (const key of KEYS) p[key] += (to[key] - p[key]) * k;
  r.body.position.y = r.hip + p.y; r.body.rotation.set(p.lean, p.twist, 0);
  r.armR.rotation.set(p.ax, 0, p.az); r.hand.rotation.x = p.wr; r.armL.rotation.set(p.bx, 0, -p.bz);
  r.legL.rotation.x = p.ll; r.legR.rotation.x = p.lr; r.head.rotation.x = p.head; r.tail.rotation.x = p.tail;
  r.root.rotation.x = -p.fall * 1.45; r.root.position.y = p.fall * 0.32;
}
function shadows(o: T.Object3D) { o.traverse((m) => { if ((m as T.Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true; } }); }

type ChinLook = { fur: number; furDark: number; snout: number; coat: number; trim: number; weave: T.Texture; long: boolean };
function chinchilla(o: ChinLook): Rig {
  const fur = furM(o.fur), furD = furM(o.furDark), coat = std(0xffffff, { map: o.weave, roughness: 0.8 }), trim = std(o.trim), dark = std(0x14161c, { roughness: 0.15 });
  const root = new T.Group(), body = new T.Group(); root.rotation.order = 'YXZ'; root.add(body);
  const legs = [-1, 1].map((s) => { const l = new T.Group(); l.position.set(s * 0.17, 0.46, 0); root.add(l); mesh(cap(0.1, 0.26), trim, 0, -0.2, 0, l); mesh(sph(0.13), fur, 0, -0.39, 0.07, l).scale.set(1, 0.55, 1.6); return l; });
  mesh(sph(0.42), fur, 0, 0.38, 0, body).scale.set(1, 1.15, 0.92);
  const cl = o.long ? 1.0 : 0.64, cb = o.long ? 0.6 : 0.49, cy = o.long ? 0.2 : 0.36;
  mesh(cyl(0.32, cb, cl), coat, 0, cy, 0, body); mesh(cyl(0.445, 0.455, 0.1), trim, 0, 0.2, 0, body);
  mesh(new T.TorusGeometry(0.27, 0.06, 8, 20), trim, 0, 0.7, 0, body).rotation.x = PI / 2;
  const head = new T.Group(); head.position.y = 1.08; body.add(head);
  mesh(sph(0.38), fur, 0, 0, 0, head).scale.set(1.12, 0.95, 1.02);
  const wM = new T.MeshBasicMaterial({ color: 0xdfe6ee });
  for (const x of [-1, 1]) {
    mesh(sph(0.2), fur, x * 0.2, -0.1, 0.14, head);
    const e = mesh(sph(0.23), fur, x * 0.32, 0.31, -0.04, head); e.scale.set(1, 1.05, 0.3); e.rotation.z = -x * 0.28;
    const i = mesh(sph(0.16), std(0xd9a9a0), x * 0.32, 0.31, 0, head); i.scale.set(1, 1.05, 0.3); i.rotation.z = -x * 0.28;
    mesh(sph(0.075), dark, x * 0.16, 0.07, 0.315, head); mesh(sph(0.022), glowM(0xffffff), x * 0.16 + 0.025, 0.1, 0.385, head);
    for (let k = -1; k <= 1; k++) { const w = mesh(cyl(0.005, 0.002, 0.34, 5), wM, x * 0.36, -0.09 + k * 0.035, 0.3, head); w.rotation.z = PI / 2 + x * k * 0.22; w.rotation.y = -x * 0.35; }
  }
  mesh(sph(0.15), std(o.snout), 0, -0.07, 0.31, head).scale.set(1.15, 0.8, 1); mesh(sph(0.045), std(0xb56b6b, { roughness: 0.3 }), 0, -0.03, 0.45, head);
  const tail = new T.Group(); tail.position.set(0, 0.22, -0.36); body.add(tail);
  [[0.24, 0, 0], [0.23, 0.13, -0.2], [0.2, 0.34, -0.32], [0.17, 0.56, -0.3], [0.13, 0.72, -0.2]].forEach((p) => mesh(sph(p[0]), furD, 0, p[1], p[2], tail));
  const arms = [-1, 1].map((s) => { const a = new T.Group(); a.position.set(s * 0.42, 0.74, 0); body.add(a); mesh(cap(0.085, 0.32), coat, 0, -0.24, 0, a); mesh(cyl(0.092, 0.092, 0.09), trim, 0, -0.42, 0, a); mesh(sph(0.09), fur, 0, -0.52, 0, a); return a; });
  const hand = new T.Group(); hand.position.y = -0.52; arms[1].add(hand);
  const tip = new T.Object3D(); hand.add(tip);
  return { root, body, head, tail, armR: arms[1], armL: arms[0], hand, legL: legs[0], legR: legs[1], hip: 0.45, pose: POSE(), tip };
}
function foxRig(): Rig {
  const fur = furM(0xb85a24), cream = furM(0xf0dcc0), lac = std(0x0f4a50, { roughness: 0.18, metalness: 0.6 }), dark = std(0x14161c), gold = std(0xd9a441, { roughness: 0.35, metalness: 0.9 });
  const root = new T.Group(), body = new T.Group(); root.rotation.order = 'YXZ'; root.add(body);
  const legs = [-1, 1].map((s) => { const l = new T.Group(); l.position.set(s * 0.16, 0.52, 0); root.add(l); mesh(cap(0.085, 0.34), dark, 0, -0.24, 0, l); mesh(sph(0.11), dark, 0, -0.46, 0.08, l).scale.set(1, 0.55, 1.7); return l; });
  mesh(sph(0.36), fur, 0, 0.4, 0, body).scale.set(1, 1.3, 0.85); mesh(cyl(0.33, 0.37, 0.6, 8), lac, 0, 0.45, 0.02, body); mesh(cyl(0.385, 0.385, 0.08, 8), gold, 0, 0.2, 0.02, body); mesh(box(0.3, 0.36, 0.06), gold, 0, 0.5, 0.33, body);
  for (const x of [-0.42, 0.42]) mesh(sph(0.2), lac, x, 0.78, 0, body).scale.set(1.1, 0.6, 1.1);
  const head = new T.Group(); head.position.y = 1.12; body.add(head);
  mesh(sph(0.3), fur, 0, 0, 0, head); mesh(new T.ConeGeometry(0.16, 0.5, 14), cream, 0, -0.06, 0.38, head).rotation.x = PI / 2; mesh(sph(0.045), dark, 0, -0.05, 0.63, head);
  for (const x of [-0.2, 0.2]) { mesh(new T.ConeGeometry(0.12, 0.36, 4), fur, x, 0.36, -0.02, head).rotation.z = -x * 0.8; mesh(sph(0.045), glowM(hdr(2.4, 1.8, 0.6)), x * 0.65, 0.06, 0.25, head); }
  mesh(cyl(0.31, 0.31, 0.1, 16), lac, 0, 0.16, 0, head);
  const tail = new T.Group(); tail.position.set(0, 0.25, -0.3); body.add(tail);
  ([[0.2, 0, 0, fur], [0.25, 0.05, -0.28, fur], [0.23, 0.16, -0.56, fur], [0.16, 0.3, -0.78, cream]] as [number, number, number, T.Material][]).forEach((p) => mesh(sph(p[0]), p[3], 0, p[1], p[2], tail));
  const arms = [-1, 1].map((s) => { const a = new T.Group(); a.position.set(s * 0.42, 0.74, 0); body.add(a); mesh(cap(0.08, 0.34), fur, 0, -0.26, 0, a); mesh(sph(0.085), dark, 0, -0.54, 0, a); return a; });
  const hand = new T.Group(); hand.position.y = -0.54; arms[1].add(hand);
  mesh(box(0.07, 0.02, 1.35), std(0xcfe0ea, { roughness: 0.15, metalness: 1 }), 0, 0, 0.78, hand); mesh(box(0.24, 0.06, 0.06), gold, 0, 0, 0.1, hand);
  const tip = new T.Object3D(); tip.position.z = 1.4; hand.add(tip);
  return { root, body, head, tail, armR: arms[1], armL: arms[0], hand, legL: legs[0], legR: legs[1], hip: 0.5, pose: POSE(), tip };
}
/** Ukhu: a spectacled bear in jade-and-bronze lacquer with a great glaive */
function bearRig(): Rig {
  const fur = furM(0x1c1a1e), cream = furM(0xe8d9b8), jade = std(0x1f6b58, { roughness: 0.2, metalness: 0.55 }), bronze = std(0xb07a35, { roughness: 0.35, metalness: 0.9 }), dark = std(0x0e0e12);
  const root = new T.Group(), body = new T.Group(); root.rotation.order = 'YXZ'; root.add(body);
  const legs = [-1, 1].map((s) => { const l = new T.Group(); l.position.set(s * 0.34, 0.86, 0); root.add(l); mesh(cap(0.22, 0.5), fur, 0, -0.38, 0, l); mesh(cyl(0.25, 0.25, 0.3, 10), jade, 0, -0.42, 0, l); mesh(sph(0.24), dark, 0, -0.76, 0.12, l).scale.set(1, 0.5, 1.6); return l; });
  mesh(sph(0.78), fur, 0, 0.62, 0, body).scale.set(1, 1.12, 0.9);
  mesh(cyl(0.66, 0.8, 0.95, 10), jade, 0, 0.62, 0.02, body); mesh(cyl(0.82, 0.82, 0.12, 10), bronze, 0, 0.2, 0.02, body); mesh(cyl(0.67, 0.67, 0.1, 10), bronze, 0, 1.06, 0.02, body);
  mesh(box(0.5, 0.6, 0.08), bronze, 0, 0.66, 0.74, body);
  for (const x of [-0.82, 0.82]) { mesh(sph(0.38), jade, x, 1.12, 0, body).scale.set(1.1, 0.62, 1.15); mesh(new T.TorusGeometry(0.36, 0.04, 6, 16), bronze, x, 1.08, 0, body).rotation.x = PI / 2; }
  const head = new T.Group(); head.position.y = 1.62; body.add(head);
  mesh(sph(0.46), fur, 0, 0, 0, head).scale.set(1.08, 0.95, 1);
  mesh(sph(0.22), cream, 0, -0.1, 0.36, head).scale.set(1.1, 0.8, 1); mesh(sph(0.08), dark, 0, -0.06, 0.56, head);
  for (const x of [-1, 1]) {
    mesh(sph(0.15), fur, x * 0.36, 0.36, -0.05, head).scale.set(1, 1, 0.5);
    mesh(new T.TorusGeometry(0.11, 0.035, 8, 18), cream, x * 0.19, 0.08, 0.4, head).rotation.y = x * 0.35;
    mesh(sph(0.055), glowM(hdr(1.9, 1.5, 0.6)), x * 0.19, 0.08, 0.41, head);
  }
  mesh(cyl(0.48, 0.5, 0.14, 12), bronze, 0, 0.3, 0, head); mesh(new T.ConeGeometry(0.16, 0.3, 4), jade, 0, 0.5, 0.1, head);
  const tail = new T.Group(); tail.position.set(0, 0.3, -0.66); body.add(tail); mesh(sph(0.2), fur, 0, 0, 0, tail);
  const arms = [-1, 1].map((s) => { const a = new T.Group(); a.position.set(s * 0.86, 1.1, 0); body.add(a); mesh(cap(0.2, 0.6), fur, 0, -0.44, 0, a); mesh(cyl(0.23, 0.23, 0.34, 10), jade, 0, -0.56, 0, a); mesh(sph(0.2), dark, 0, -0.94, 0, a); return a; });
  const hand = new T.Group(); hand.position.y = -0.94; arms[1].add(hand);
  mesh(cyl(0.055, 0.055, 3.4, 10), std(0x3a2a24), 0, 0, 0.6, hand).rotation.x = PI / 2;
  const bl = new T.Shape(); bl.moveTo(0, 0); bl.quadraticCurveTo(0.34, 0.5, 0.06, 1.15); bl.quadraticCurveTo(-0.1, 0.5, -0.1, 0);
  const blade = mesh(new T.ExtrudeGeometry(bl, { depth: 0.04, bevelEnabled: false }), std(0xd4e6ee, { roughness: 0.12, metalness: 1 }), 0.02, 0, 2.28, hand); blade.rotation.set(PI / 2, 0, PI / 2);
  mesh(cyl(0.11, 0.11, 0.16, 10), bronze, 0, 0, 2.26, hand).rotation.x = PI / 2;
  const tip = new T.Object3D(); tip.position.z = 3.2; hand.add(tip);
  return { root, body, head, tail, armR: arms[1], armL: arms[0], hand, legL: legs[0], legR: legs[1], hip: 0.86, pose: POSE(), tip };
}

// ---------------------------------------------------------------- poses
function doraPose(g: Fight, now: number): Pose {
  const p = POSE(), t = g.t, br = Math.sin(now * 2.4) * 0.03;
  p.tail = Math.sin(now * 2.6) * 0.12;
  switch (g.state) {
    case 'idle': p.y = br; p.ax = -1.1 + br; p.wr = 0.25; break;
    case 'run': { const s = Math.sin(now * 15); p.lean = 0.38; p.ll = s * 0.95; p.lr = -s * 0.95; p.ax = -0.7 - s * 0.25; p.az = -0.5; p.wr = 1.0; p.bx = s * 0.8; p.y = Math.abs(Math.cos(now * 15)) * 0.07; p.tail = -0.4; break; }
    case 'cut1': { const c = CUTS[0], k = es(t, c.hit - 3, c.hit + 2), back = es(t, c.hit + 4, c.len); p.twist = mix(mix(0.95, -1.0, k), 0, back); p.ax = -1.45; p.az = mix(mix(-1.15, 0.55, k), -0.15, back); p.wr = 1.25; p.lean = 0.3; p.ll = 0.5; p.lr = -0.45; p.bx = -0.6; break; }
    case 'cut2': { const c = CUTS[1], k = es(t, c.hit - 3, c.hit + 2), back = es(t, c.hit + 4, c.len); p.twist = mix(mix(-0.95, 0.95, k), 0, back); p.ax = mix(mix(-0.55, -2.35, k), -1.1, back); p.az = mix(mix(0.6, -0.7, k), -0.15, back); p.wr = 1.2; p.lean = 0.22; p.ll = -0.4; p.lr = 0.5; p.bx = 0.5; break; }
    case 'cut3': { const c = CUTS[2], up = Math.sin(PI * seg(t, 0, c.hit + 2)), k = es(t, c.hit - 3, c.hit + 1), back = es(t, c.hit + 8, c.len); p.y = up * 0.6 - k * 0.18 * (1 - back); p.ax = mix(mix(-3.05, -0.75, k), -1.1, back); p.wr = mix(0.5, 1.3, k); p.lean = mix(mix(-0.2, 0.6, k), 0.08, back); p.ll = up * 0.9; p.lr = up * 0.4; p.bx = mix(-2.6, 0.2, k); p.tail = -0.6 * up; break; }
    case 'guard': p.y = -0.1; p.lean = 0.12; p.ax = -1.5; p.az = 0.5; p.wr = 0.05; p.bx = -1.25; p.bz = -0.35; p.ll = 0.35; p.lr = -0.3; break;
    case 'deflect': p.ax = -2.25; p.az = 0.2; p.wr = 0.7; p.lean = -0.18; p.twist = 0.45; p.bx = -0.5; p.ll = -0.3; p.lr = 0.4; break;
    case 'dodge': { const k = Math.sin(PI * seg(t, 0, DODGE.len)); p.y = -0.32 * k; p.lean = 0.95 * k; p.ax = -0.4; p.az = -0.9; p.wr = 1.3; p.bx = 0.6; p.ll = 1.1 * k; p.lr = -0.8 * k; p.tail = -0.8 * k; break; }
    case 'hit': p.lean = -0.5; p.ax = -0.25; p.az = -0.95; p.bx = -0.5; p.bz = 0.9; p.head = -0.45; p.lr = 0.4; break;
    case 'recoil': p.lean = -0.32; p.ax = -2.7; p.az = -0.7; p.wr = 0.3; p.twist = 0.5; p.lr = 0.45; p.ll = -0.2; break;
    case 'broken': p.y = -0.42 + br; p.lean = 0.72; p.head = 0.5; p.ax = -0.35; p.wr = 1.4; p.bx = -0.2; p.ll = 1.25; p.lr = -0.35; break;
    case 'finisher': { const w = es(t, 0, FINISHER.hit - 4), k = es(t, FINISHER.hit - 4, FINISHER.hit), f = es(t, FINISHER.hit + 8, FINISHER.len - 4); p.twist = mix(mix(0, 1.25, w), -0.6, k) * (1 - f); p.ax = mix(mix(-1.2, -1.57, k), -2.9, f); p.az = mix(-1.25 * w, 0.1, k); p.wr = mix(1.5, 0.3, f); p.lean = mix(0.4, 0.62, k) * (1 - f); p.y = -0.2 * w * (1 - f); p.ll = 0.7 * (1 - f); p.lr = -0.7 * (1 - f); p.bx = -0.4; break; }
    case 'tag': { const k = Math.sin(PI * seg(t, 0, TAG.len)); p.bx = -2.7 * k; p.bz = 0.3; p.ax = -0.5; p.az = -0.6; p.wr = 1.2; p.lean = -0.1; p.twist = -0.4 * k; break; }
    case 'dead': p.fall = es(t, 0, 30); p.ax = -0.2; p.az = -1.1; p.bx = -0.2; p.bz = 1.0; p.head = -0.3; break;
    case 'win': p.y = Math.abs(Math.sin(now * 5)) * 0.16; p.ax = -3.0; p.wr = 0.2; p.bx = -2.4; p.bz = 0.5; p.head = -0.25; break;
  }
  return p;
}
function enzoPose(g: Fight, now: number): Pose {
  const p = POSE(), e = g.enzo, br = Math.sin(now * 2) * 0.03;
  p.ax = -1.38 + br; p.az = 0; p.wr = 0; p.bx = -0.2; p.tail = Math.sin(now * 2.1) * 0.12; p.y = br;
  if (g.phase === 'won') { p.y = Math.abs(Math.sin(now * 5 + 1)) * 0.2; p.ax = -2.7; p.bx = -2.7; p.bz = 0.5; p.head = -0.25; return p; }
  if (e.state === 'wait') { if (g.tag >= 100) { p.y = Math.abs(Math.sin(now * 6)) * 0.1; p.bx = -2.2; p.bz = 0.4; } else if (g.combo >= 5) { p.bx = -1.2 + Math.sin(now * 8) * 0.3; } return p; }
  if (e.state === 'leap') { const k = Math.sin(PI * seg(e.t, 0, 22)); p.y = k * 0.9; p.ax = -2.9; p.bx = -2.6; p.lean = 0.3; p.ll = 0.8 * k; p.lr = 0.5 * k; p.tail = -0.7; return p; }
  if (e.state === 'strike') { const k = es(e.t, 0, 4), back = es(e.t, 14, 30); p.ax = mix(mix(-2.9, -0.7, k), -1.38, back); p.bx = mix(-2.6, -0.7, k); p.lean = mix(0.55 * k, 0.08, back); p.y = -0.18 * k * (1 - back); p.ll = 0.5 * (1 - back); p.lr = -0.4 * (1 - back); return p; }
  const s = Math.sin(now * 13); p.lean = 0.25; p.ll = s * 0.8; p.lr = -s * 0.8; p.bx = s * 0.6; p.y = Math.abs(Math.cos(now * 13)) * 0.05; return p;
}
function foePose(f: Foe, now: number): Pose {
  const p = POSE(), t = f.t, bear = f.kind === 'bear', br = Math.sin(now * 2.2 + f.id) * 0.03, a = f.atk;
  p.tail = Math.sin(now * 2.2 + f.id) * 0.15; p.ax = bear ? -1.25 : -1.0; p.wr = bear ? 0.1 : 0.3; if (bear) { p.bx = -0.9; p.bz = -0.5; }
  const walk = () => { const s = Math.sin(now * (bear ? 7 : 10) + f.id); p.ll = s * (bear ? 0.5 : 0.7); p.lr = -s * (bear ? 0.5 : 0.7); p.y = Math.abs(Math.cos(now * (bear ? 7 : 10) + f.id)) * 0.05; p.lean = 0.15; };
  const windup = (k: number) => {
    if (!a) return;
    if (a.id === 'slash') { p.ax = mix(-1.0, -2.85, k); p.twist = 0.6 * k; p.lean = -0.15 * k; p.wr = 0.4; p.lr = 0.3 * k; }
    else if (a.id === 'lunge' || a.id === 'thrust') { p.ax = mix(-1.0, -0.85, k); p.az = -0.5 * k; p.wr = mix(0.3, 1.45, k); p.twist = 0.85 * k; p.y = -0.2 * k; p.lean = 0.3 * k; p.ll = 0.6 * k; p.lr = -0.5 * k; if (bear) p.bx = -0.6; }
    else if (a.id === 'sweep') { p.twist = 1.3 * k; p.ax = -1.4; p.az = -1.25 * k; p.wr = 1.3; p.lean = 0.1; p.ll = 0.4 * k; p.lr = -0.4 * k; p.bx = -1.3; p.bz = -0.6; }
    else { p.ax = mix(-1.25, -3.05, k); p.bx = mix(-0.9, -3.0, k); p.bz = -0.2; p.wr = 0.25; p.lean = -0.3 * k; p.y = 0.12 * k; }
  };
  const strike = () => {
    if (!a) return;
    if (a.id === 'slash') { p.ax = -0.55; p.twist = -0.7; p.lean = 0.42; p.wr = 0.9; p.ll = 0.5; p.lr = -0.4; }
    else if (a.id === 'lunge' || a.id === 'thrust') { p.ax = -1.55; p.wr = 1.5; p.twist = -0.35; p.lean = 0.62; p.y = -0.15; p.ll = 0.9; p.lr = -0.7; if (bear) p.bx = -1.3; }
    else if (a.id === 'sweep') { p.twist = -1.3; p.ax = -1.4; p.az = 0.75; p.wr = 1.3; p.lean = 0.3; p.ll = -0.4; p.lr = 0.4; p.bx = -1.0; }
    else { p.ax = -0.45; p.bx = -0.5; p.wr = 1.0; p.lean = 0.72; p.y = -0.28; p.ll = 0.5; p.lr = 0.5; }
  };
  switch (f.state) {
    case 'enter': case 'stalk': walk(); p.y += br; break;
    case 'windup': windup(ease(seg(t, 0, (a?.windup ?? 30) * 0.7))); break;
    case 'strike': strike(); break;
    case 'recover': { strike(); const k = es(t, (a?.recover ?? 30) * 0.45, a?.recover ?? 30), q = POSE(); for (const key of KEYS) p[key] = mix(p[key], key === 'ax' ? (bear ? -1.25 : -1.0) : q[key], k); break; }
    case 'hit': p.lean = -0.45; p.ax = -0.4; p.az = -0.95; p.head = -0.4; p.lr = 0.4; break;
    case 'deflected': p.ax = -3.0; p.az = -0.9; p.lean = -0.55; p.twist = 0.5; p.head = -0.3; p.lr = 0.5; p.ll = -0.2; if (bear) { p.bx = -0.2; p.bz = 0.8; } break;
    case 'broken': p.y = (bear ? -0.6 : -0.42) + br; p.lean = 0.62; p.head = 0.5; p.ax = -0.3; p.wr = 0.1; p.bx = -0.1; p.ll = 1.2; p.lr = -0.3; break;
    case 'dead': p.fall = es(t, 0, 34); p.ax = -0.2; p.az = -1.1; p.bx = -0.2; p.bz = 1.0; p.head = -0.3; break;
  }
  return p;
}

// ---------------------------------------------------------------- effects
/** a brush stroke: thick in the middle, tapered at both ends, brightest at the leading tip */
function arcGeo(r0: number, r1: number, len: number) {
  const n = 48, pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, a = k * len, w = Math.pow(Math.sin(PI * Math.min(1, k * 1.12)), 0.7), ri = mix(r1 - 0.02, r0, w), c = Math.pow(k, 1.7);
    pos.push(Math.cos(a) * ri, Math.sin(a) * ri, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0); col.push(c * 0.45, c * 0.45, c * 0.45, c, c, c);
    if (i < n) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g;
}
const addMat = (c: T.Color, vertexColors = false) => new T.MeshBasicMaterial({ vertexColors, color: c, transparent: true, opacity: 0, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false, fog: false });
type Fx = { o: T.Object3D; mat: T.Material; life: number; max: number; grow: number; s0: number; spin: number };

export class CloudsteelScene {
  private renderer: T.WebGPURenderer; private scene = new T.Scene(); private cam = new T.PerspectiveCamera(42, 16 / 9, 0.1, 700);
  private pipe: T.RenderPipeline | null = null; private fxOn: boolean;
  private dora!: Rig; private enzo!: Rig; private foes = new Map<number, Rig>(); private staffL!: T.PointLight; private staffGlow!: T.Sprite;
  private fx: Fx[] = []; private trails: T.Mesh[] = []; private trailBox = new T.Group(); private tagRing!: T.Mesh; private jadeRing!: T.Mesh; private glint!: T.Sprite; private mark!: T.Mesh; private finish!: T.Mesh;
  private sparks!: T.InstancedMesh; private sP: T.Vector3[] = []; private sV: T.Vector3[] = []; private sLife = new Float32Array(140); private sNext = 0; private dum = new T.Object3D();
  private rainPos!: Float32Array; private rainG!: T.BufferGeometry; private mists: T.Sprite[] = []; private lamps: T.PointLight[] = []; private posts: T.Group[] = [];
  private softTex!: T.Texture; private inkTex!: T.Texture;
  private now = 0; private shake = 0; private yaw = PI; private camPos = new T.Vector3(0, 4, 10); private look = new T.Vector3(0, 1.2, 0);
  /** 'webgpu' or 'webgl2', for the settings screen */
  backend: 'webgpu' | 'webgl2' = 'webgl2';

  /** the yaw the camera looks along, so the page can turn stick input into world directions */
  get camYaw() { return this.yaw; }

  static async create(canvas: HTMLCanvasElement, fx: boolean) {
    const renderer = new T.WebGPURenderer({ canvas, antialias: true });
    await renderer.init();
    return new CloudsteelScene(renderer, fx);
  }
  private constructor(renderer: T.WebGPURenderer, fx: boolean) {
    this.renderer = renderer; this.fxOn = fx;
    this.backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fx ? 2 : 1.25));
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.scene.fog = new T.FogExp2(0x12283a, 0.016);
    this.buildWorld(); this.buildFigures(); this.buildEffects();
    if (fx) {
      const scenePass = pass(this.scene, this.cam, { samples: 4 }), col = scenePass.getTextureNode();
      const vig = float(1).sub(smoothstep(0.35, 0.95, screenUV.sub(0.5).length()).mul(0.55));
      this.pipe = new T.RenderPipeline(renderer); this.pipe.outputNode = col.add(bloom(col, 0.38, 0.5, 1)).mul(vig);
    }
    this.resize();
  }
  resize() {
    const c = this.renderer.domElement, w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.cam.fov = w / h < 1 ? 58 : 42; this.cam.updateProjectionMatrix();
  }
  dispose() { this.renderer.dispose(); }

  // ---------------------------------------------------------------- the citadel
  private buildWorld() {
    const sc = this.scene, add = <O extends T.Object3D>(o: O) => { sc.add(o); return o; };
    const sky = canvasTex(1024, 512, (g, w, h) => {
      const l = g.createLinearGradient(0, 0, 0, h); l.addColorStop(0, '#040714'); l.addColorStop(0.3, '#0c1632'); l.addColorStop(0.47, '#12283a'); l.addColorStop(0.53, '#12283a'); l.addColorStop(1, '#070d12'); g.fillStyle = l; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 420; i++) { const y = Math.pow(Math.random(), 1.6) * h * 0.42; g.fillStyle = `rgba(220,232,255,${(0.25 + Math.random() * 0.6) * (1 - y / (h * 0.45))})`; g.fillRect(Math.random() * w, y, Math.random() < 0.12 ? 2 : 1, Math.random() < 0.12 ? 2 : 1); }
    });
    sky.mapping = T.EquirectangularReflectionMapping; sc.environment = sky; sc.environmentIntensity = 0.6;
    add(mesh(new T.SphereGeometry(300, 32, 16), new T.MeshBasicMaterial({ map: sky, side: T.BackSide, fog: false, depthWrite: false })));
    // the painted panorama, mirrored so it joins up all the way round
    const pano = loadTex('backdrop'); pano.wrapS = T.MirroredRepeatWrapping; pano.repeat.x = 2;
    const ring = add(mesh(new T.CylinderGeometry(150, 150, 110, 48, 1, true), new T.MeshBasicMaterial({ map: pano, color: 0x7888a0, side: T.BackSide, fog: false, depthWrite: false }), 0, -12, 0)); ring.renderOrder = -1;
    this.softTex = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
    this.inkTex = canvasTex(128, 128, (g, w) => { g.fillStyle = '#fff'; for (let i = 0; i < 26; i++) { const a = Math.random() * PI * 2, d = Math.pow(Math.random(), 0.7) * 46, r = 4 + Math.random() * (i < 6 ? 26 : 9); g.beginPath(); g.arc(w / 2 + Math.cos(a) * d, w / 2 + Math.sin(a) * d, r, 0, PI * 2); g.fill(); } });
    const moonTex = canvasTex(256, 256, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(240,246,255,1)'); r.addColorStop(0.3, 'rgba(232,240,255,1)'); r.addColorStop(0.33, 'rgba(170,200,255,.35)'); r.addColorStop(1, 'rgba(120,170,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); g.fillStyle = 'rgba(150,170,205,.35)'; [[110, 104, 13], [146, 132, 9], [122, 150, 7], [150, 98, 6]].forEach((c) => { g.beginPath(); g.arc(c[0], c[1], c[2], 0, PI * 2); g.fill(); }); });
    const moon = add(new T.Sprite(new T.SpriteMaterial({ map: moonTex, color: hdr(1.5, 1.7, 2.1), fog: false, transparent: true, depthWrite: false }))); moon.scale.set(40, 40, 1); moon.position.set(-22, 46, -110);

    add(new T.HemisphereLight(0x6f8fd0, 0x10201c, 0.95));
    const moonL = add(new T.DirectionalLight(0xa9c6ff, 2.4)); moonL.position.set(-9, 16, -12); moonL.castShadow = true;
    moonL.shadow.mapSize.set(2048, 2048); Object.assign(moonL.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 }); moonL.shadow.bias = -0.0015; moonL.shadow.radius = 3;
    const fill = add(new T.DirectionalLight(0x4f7f8f, 0.6)); fill.position.set(3, 5, 10);

    const stoneT = loadTex('stone', 3), stone = std(0xe4ecf8, { map: stoneT, roughness: 0.8 }), stoneDark = std(0xa8b6cc, { map: stoneT, roughness: 0.85 }), wood = std(0x3a2a24), roof = std(0xc8dcdc, { map: loadTex('roof', 2), roughness: 0.5 }), gold = std(0xd9a441, { roughness: 0.35, metalness: 0.9 }), lampM = glowM(hdr(1.25, 0.64, 0.17));
    const R = ARENA_R + 1.4;
    add(mesh(cyl(R, R + 0.6, 1.2, 48), stone, 0, -0.6, 0)).receiveShadow = true;
    // the rain-soaked floor: the painted paving with a rippled planar reflection on top
    const floorMat = new T.MeshStandardNodeMaterial({ map: loadTex('floor'), roughness: 0.32, metalness: 0.15 });
    if (this.fxOn) {
      const refl = reflector({ resolutionScale: 0.6, samples: 4 }); refl.target.rotateX(-PI / 2); refl.target.position.y = 0.006; sc.add(refl.target);
      const wp = positionWorld.mul(1.9); refl.uvNode = refl.uvNode!.add(vec2(mx_noise_float(wp), mx_noise_float(wp.add(11.3))).mul(0.0035));
      floorMat.emissiveNode = refl.rgb.mul(0.28);
    }
    const floor = add(mesh(new T.CircleGeometry(R - 0.05, 64), floorMat, 0, 0.006, 0)); floor.rotation.x = -PI / 2; floor.receiveShadow = true;
    add(mesh(cyl(R + 0.6, 5.5, 34, 14), stoneDark, 0, -18.2, 0));
    add(mesh(new T.TorusGeometry(R + 0.05, 0.16, 8, 64), stoneDark, 0, 0.1, 0)).rotation.x = PI / 2;
    [0.35, 1.25, 2.1, 2.9, 4.1, 5.3].forEach((a, i) => {
      const g = add(new T.Group()); g.position.set(Math.sin(a) * (R - 0.7), 0, -Math.cos(a) * (R - 0.7)); g.rotation.y = -a; this.posts.push(g);
      mesh(box(0.22, 3.1, 0.22), wood, 0, 1.55, 0, g).castShadow = true; mesh(box(0.2, 0.16, 1.1), wood, 0, 2.95, 0.4, g); mesh(box(1.3, 0.12, 0.5), roof, 0, 3.2, 0, g);
      mesh(box(0.02, 0.45, 0.02), wood, 0, 2.65, 0.8, g); const l = mesh(box(0.34, 0.46, 0.34), lampM, 0, 2.25, 0.8, g); mesh(box(0.42, 0.06, 0.42), wood, 0, 2.5, 0.8, g); mesh(box(0.42, 0.06, 0.42), wood, 0, 2.0, 0.8, g);
      const s = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: 0xffc45e, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false })); s.scale.set(3, 3, 1); s.position.copy(l.position); g.add(s);
      if (i % 2 === 0) { const p = new T.PointLight(0xffb44d, 30, 20, 2); p.position.set(0, 2.25, 0.8); g.add(p); this.lamps.push(p); }
    });
    for (let i = 0; i < 7; i++) add(mesh(box(5 - i * 0.12, 0.4, 0.9), stone, 0, 0.2 + i * 0.4 - 0.4, -R - 0.2 - i * 0.85)).receiveShadow = true;
    const temple = add(new T.Group()); temple.position.set(0, 2.4, -R - 10.5);
    mesh(box(15, 2.4, 8), stone, 0, -1.2, 0, temple); mesh(box(10.5, 3.6, 5.4), stoneDark, 0, 1.8, 0, temple);
    const tier = (w: number, y: number, s: number) => { const r = mesh(new T.ConeGeometry(w, 1.9 * s, 4), roof, 0, y, 0, temple); r.rotation.y = PI / 4; r.scale.z = 0.62; };
    tier(9.4, 4.5, 1); mesh(box(6, 2.3, 3.4), stoneDark, 0, 5.9, 0, temple); tier(6, 7.9, 0.9); mesh(box(3, 1.6, 2), stoneDark, 0, 8.9, 0, temple); tier(3.6, 10.4, 0.8);
    const door = new T.Shape(); door.moveTo(-0.9, 0); door.lineTo(0.9, 0); door.lineTo(0.62, 2.5); door.lineTo(-0.62, 2.5);
    const doorG = new T.ShapeGeometry(door); [-3.4, 0, 3.4].forEach((x, i) => { const d = mesh(doorG, lampM, x, 0, 2.72, temple); if (i !== 1) { d.scale.set(0.6, 0.6, 1); d.position.y = 0.9; } });
    [-1.8, 0, 1.8].forEach((x) => mesh(box(0.6, 0.9, 0.1), lampM, x, 5.6, 1.72, temple));
    const tl = add(new T.PointLight(0xffb44d, 60, 30, 2)); tl.position.set(0, 3.4, -R - 6.5);
    [-3.6, 3.6].forEach((x) => {
      const g = add(new T.Group()); g.position.set(x, 0, -R + 0.5);
      [[1, 0.9, 0.5], [0.8, 0.8, 1.35], [1, 0.7, 2.1], [0.7, 0.7, 2.8]].forEach((d) => { mesh(box(d[0], d[1], d[0]), stoneDark, 0, d[2], 0, g).castShadow = true; });
      mesh(box(2.6, 0.22, 0.5), stone, 0, 3.3, 0, g).castShadow = true; mesh(new T.ConeGeometry(0.3, 0.7, 4), gold, 0, 3.75, 0.1, g).rotation.x = 0.5;
      [-0.2, 0.2].forEach((e) => mesh(box(0.14, 0.1, 0.05), lampM, e, 2.9, 0.36, g));
    });
    const bridge = add(new T.Group()); bridge.position.set(R - 0.3, 0, 2.5); bridge.rotation.y = -0.35;
    const ropeM = new T.LineBasicMaterial({ color: 0x6b5a44 });
    for (const z of [-0.75, 0.75]) { const pts: T.Vector3[] = []; for (let i = 0; i <= 20; i++) { const k = i / 20; pts.push(new T.Vector3(k * 22, 1.1 - Math.sin(k * PI) * 1.5, z)); } bridge.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), ropeM)); mesh(box(0.2, 1.5, 0.2), wood, 0, 0.6, z, bridge); }
    for (let i = 0; i < 26; i++) { const k = (i + 0.5) / 26; mesh(box(0.6, 0.07, 1.5), wood, k * 22, -Math.sin(k * PI) * 1.5, 0, bridge).rotation.z = -Math.cos(k * PI) * 0.2; }
    add(mesh(cyl(4, 6, 40, 8), stoneDark, 30, -21, -5.5)); add(mesh(box(3, 2, 3), stoneDark, 30, 0, -5.5)); add(mesh(new T.ConeGeometry(3, 1.4, 4), roof, 30, 2.2, -5.5)).rotation.y = PI / 4;
    add(mesh(cyl(5, 7, 50, 8), stoneDark, -26, -20, -16));
    add(mesh(new T.PlaneGeometry(2.2, 30), new T.MeshBasicMaterial({ color: 0x9fe0d0, transparent: true, opacity: 0.35, depthWrite: false }), -23.5, -9, -11.2)).rotation.y = 0.5;
    for (let i = 0; i < 16; i++) {
      const s = add(new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: 0x7fd1b4, transparent: true, opacity: 0.06 + Math.random() * 0.07, depthWrite: false })));
      const a = Math.random() * PI * 2, d = 14 + Math.random() * 26; s.position.set(Math.cos(a) * d, -3 + Math.random() * 5, Math.sin(a) * d - 6); const k = 16 + Math.random() * 20; s.scale.set(k, k * 0.5, 1); s.userData.v = (Math.random() - 0.5) * 0.5; this.mists.push(s);
    }
    const RN = 1500; this.rainPos = new Float32Array(RN * 6); this.rainG = new T.BufferGeometry();
    for (let i = 0; i < RN; i++) { const x = (Math.random() - 0.5) * 44, y = Math.random() * 22 - 2, z = (Math.random() - 0.5) * 44; this.rainPos.set([x, y, z, x + 0.05, y - 0.6, z], i * 6); }
    this.rainG.setAttribute('position', new T.BufferAttribute(this.rainPos, 3));
    const rain = add(new T.LineSegments(this.rainG, new T.LineBasicMaterial({ color: 0xa8d8e8, transparent: true, opacity: 0.3 }))); rain.frustumCulled = false;
  }

  private buildFigures() {
    const gold = std(0xd9a441, { roughness: 0.35, metalness: 0.9 });
    // Dora: cream-white fur, saffron jacket with indigo woven bands, a waist sash, a slim curved blade
    const d = this.dora = chinchilla({ fur: 0xf3ead6, furDark: 0xe6dac0, snout: 0xfffaf0, coat: 0xe08f14, trim: 0x27348a, weave: loadTex('weave-dora', 2), long: false });
    const sash = new T.Group(); sash.position.set(0.2, 0.2, -0.4); d.body.add(sash); mesh(box(0.14, 0.5, 0.03), std(0x27348a), 0, -0.22, 0, sash).rotation.x = 0.35; d.extra = { sash };
    const curve = new T.QuadraticBezierCurve3(new T.Vector3(0, 0, 0.1), new T.Vector3(0, -0.04, 0.75), new T.Vector3(0, 0.2, 1.4));
    mesh(new T.TubeGeometry(curve, 24, 0.05, 8), std(0xe8f2ff, { roughness: 0.12, metalness: 1, emissive: 0x8a6a20, emissiveIntensity: 0.6 }), 0, 0, 0, d.hand).scale.x = 0.25;
    mesh(box(0.2, 0.05, 0.05), gold, 0, 0, 0.1, d.hand); mesh(cyl(0.035, 0.035, 0.24), std(0x27348a), 0, 0, -0.02, d.hand).rotation.x = PI / 2; d.tip.position.set(0, 0.15, 1.3);
    // Enzo: grey fur, long slate-blue coat with gold-and-jade bands, a lantern staff
    const e = this.enzo = chinchilla({ fur: 0x8d939c, furDark: 0x7a808a, snout: 0xc9cdd3, coat: 0x3a5578, trim: 0x22324a, weave: loadTex('weave-enzo', 2), long: true });
    mesh(cyl(0.04, 0.04, 2.1, 10), std(0x3a2a24), 0, 0, 0.4, e.hand).rotation.x = PI / 2; mesh(box(0.26, 0.26, 0.32), glowM(hdr(1.9, 1.1, 0.3)), 0, 0, 1.55, e.hand); mesh(box(0.32, 0.32, 0.05), gold, 0, 0, 1.36, e.hand); mesh(box(0.32, 0.32, 0.05), gold, 0, 0, 1.74, e.hand);
    this.staffL = new T.PointLight(0xffc45e, 14, 12, 2); this.staffL.position.z = 1.55; e.hand.add(this.staffL);
    this.staffGlow = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: 0xffc45e, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false })); this.staffGlow.position.z = 1.55; this.staffGlow.scale.set(1.8, 1.8, 1); e.hand.add(this.staffGlow);
    for (const r of [d, e]) { shadows(r.root); this.scene.add(r.root); }
  }

  private buildEffects() {
    const sc = this.scene, gold = hdr(2.4, 1.25, 0.22);
    sc.add(this.trailBox);
    // one stroke per cut, in Dora's own frame: a flat sweep right to left, a rising backhand, an overhead chop
    const defs: [number, number, number, [number, number, number]][] = [[1.25, 1.85, 3.3, [PI / 2, 0, -0.1]], [1.3, 1.95, 3.4, [PI / 2 - 0.55, 0, 0]], [1.4, 2.2, 3.5, [0, PI / 2, 0.6]]];
    defs.forEach(([r0, r1, len, rot], i) => { const m = new T.Mesh(arcGeo(r0, r1, len), addMat(gold, true)); m.rotation.set(rot[0], rot[1], rot[2]); if (i === 1) m.scale.x = -1; m.visible = false; m.frustumCulled = false; m.position.y = 1.1; this.trailBox.add(m); this.trails.push(m); });
    this.tagRing = mesh(new T.RingGeometry(0.82, 1, 64), addMat(hdr(3.2, 2.2, 0.8)), 0, 0.2, 0, sc); this.tagRing.rotation.x = -PI / 2; this.tagRing.visible = false;
    this.jadeRing = mesh(new T.RingGeometry(0.9, 1, 64), addMat(hdr(0.5, 2.6, 1.6)), 0, 0.06, 0, sc); this.jadeRing.rotation.x = -PI / 2; this.jadeRing.visible = false;
    this.mark = mesh(new T.RingGeometry(0.86, 1, 40), addMat(hdr(1.6, 1.1, 0.4)), 0, 0.05, 0, sc); this.mark.rotation.x = -PI / 2; (this.mark.material as T.MeshBasicMaterial).opacity = 0.7;
    this.finish = mesh(new T.OctahedronGeometry(0.2), glowM(hdr(3, 2, 0.6)), 0, 0, 0, sc); this.finish.visible = false;
    this.glint = new T.Sprite(new T.SpriteMaterial({ map: this.softTex, color: hdr(3, 2.2, 1), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })); sc.add(this.glint);
    this.sparks = new T.InstancedMesh(box(0.028, 0.028, 0.2), glowM(hdr(5, 3, 0.9)), 140); this.sparks.frustumCulled = false; sc.add(this.sparks);
    for (let i = 0; i < 140; i++) { this.sP.push(new T.Vector3(0, -999, 0)); this.sV.push(new T.Vector3(0, 1, 0)); }
  }
  private burst(x: number, y: number, z: number, n: number, sp: number) {
    for (let i = 0; i < n; i++) { const j = this.sNext++ % 140, a = Math.random() * PI * 2, u = Math.random() * 2 - 1, q = Math.sqrt(1 - u * u), v = sp * (0.4 + Math.random()); this.sP[j].set(x, y, z); this.sV[j].set(Math.cos(a) * q * v, Math.abs(u) * v + 1, Math.sin(a) * q * v); this.sLife[j] = 0.5 + Math.random() * 0.5; }
  }
  private puff(x: number, y: number, z: number, size: number, color: T.ColorRepresentation, ink: boolean, life = 0.35) {
    const mat = new T.SpriteMaterial({ map: ink ? this.inkTex : this.softTex, color, transparent: true, opacity: 1, blending: ink ? T.NormalBlending : T.AdditiveBlending, depthWrite: false, fog: false, rotation: Math.random() * 6 });
    const s = new T.Sprite(mat); s.position.set(x, y, z); s.scale.setScalar(size); this.scene.add(s); this.fx.push({ o: s, mat, life, max: life, grow: ink ? 1.4 : 0.6, s0: size, spin: 0 });
  }

  /** the fight's events, as they happen */
  event(e: FightEvent, g: Fight, reduced = false) {
    const kick = (n: number) => { if (!reduced) this.shake = Math.max(this.shake, n); };
    switch (e.t) {
      case 'swing': { const m = this.trails[e.n]; m.userData.life = 1; break; }
      case 'hit': this.puff(e.x, 1.2, e.z, 1.3, 0x0c1238, true, 0.45); this.puff(e.x, 1.2, e.z, e.heavy ? 2.2 : 1.4, hdr(1.5, 1.05, 0.45), false); this.burst(e.x, 1.2, e.z, e.heavy ? 22 : 12, 4); kick(e.heavy ? 0.16 : 0.08); break;
      case 'deflect': this.puff(e.x, 1.5, e.z, 2.8, hdr(1.8, 1.3, 0.55), false, 0.4); this.burst(e.x, 1.5, e.z, 38, 5.5); kick(0.25); break;
      case 'block': this.puff(e.x, 1.4, e.z, 1.2, hdr(0.8, 0.9, 1.2), false, 0.25); this.burst(e.x, 1.4, e.z, 8, 3); kick(0.1); break;
      case 'parried': this.puff(e.x, 1.4, e.z, 1.6, hdr(0.9, 1.3, 1.4), false, 0.3); this.burst(e.x, 1.4, e.z, 14, 4); kick(0.12); break;
      case 'hurt': this.puff(g.x, 1.1, g.z, 1.8, e.jade ? hdr(0.4, 1.6, 1.0) : hdr(1.6, 0.6, 0.3), false, 0.3); this.puff(g.x, 1.0, g.z, 1.2, 0x0c1238, true, 0.4); kick(0.28); break;
      case 'finisherHit': this.puff(e.x, 1.2, e.z, 4, hdr(2, 1.4, 0.5), false, 0.5); this.puff(e.x, 1.2, e.z, 2.4, 0x0c1238, true, 0.6); this.burst(e.x, 1.2, e.z, 50, 6.5); kick(0.32); break;
      case 'tagHit': this.tagRing.position.set(e.x, 0.2, e.z); this.tagRing.userData.life = 1; this.puff(e.x, 1.2, e.z, 4.5, hdr(2, 1.5, 0.6), false, 0.5); this.burst(e.x, 1.0, e.z, 50, 6); kick(0.3); break;
      case 'broken': { const f = g.foe(e.id); if (f) { this.puff(f.x, 1.3, f.z, 3, hdr(1.8, 1.3, 0.5), false, 0.45); this.burst(f.x, 1.3, f.z, 24, 5); } kick(0.2); break; }
      case 'dead': { const f = g.foe(e.id); if (f) this.puff(f.x, 0.9, f.z, 2.6, 0x0c1238, true, 0.9); break; }
      case 'guardBroken': this.puff(g.x, 1.2, g.z, 2.2, hdr(0.9, 1, 1.4), false, 0.4); kick(0.22); break;
    }
  }

  /** one frame: pose every figure from the fight, run the effects, aim the camera, draw */
  render(g: Fight, dt: number, reduced = false) {
    this.now += dt; const now = this.now, k = 1 - Math.exp(-dt * 20), kFast = 1 - Math.exp(-dt * 34);
    // figures
    const snap = g.state.startsWith('cut') || g.state === 'deflect' || g.state === 'finisher' || g.state === 'hit' || g.state === 'recoil';
    applyPose(this.dora, doraPose(g, now), snap ? kFast : k);
    const spin = g.state === 'dodge' ? es(g.t, 0, DODGE.len) * PI * 2 : g.state === 'cut2' ? 0 : 0;
    this.dora.root.position.x = g.x; this.dora.root.position.z = g.z; this.dora.root.rotation.y = g.face + spin; this.dora.extra!.sash.rotation.x = 0.3 + Math.sin(now * 7) * 0.2 + (g.state === 'run' ? 0.7 : 0);
    applyPose(this.enzo, enzoPose(g, now), k); this.enzo.root.position.x = g.enzo.x; this.enzo.root.position.z = g.enzo.z; this.enzo.root.rotation.y = g.enzo.face;
    const pulse = g.enzo.state === 'strike' ? Math.max(0, 1 - g.enzo.t / 30) : 0; this.staffL.intensity = 14 + pulse * 50; this.staffGlow.scale.setScalar(1.8 + pulse * 3);
    const seen = new Set<number>();
    for (const f of g.foes) {
      if (f.gone) continue; seen.add(f.id);
      let r = this.foes.get(f.id);
      if (!r) { r = f.kind === 'bear' ? bearRig() : foxRig(); shadows(r.root); this.scene.add(r.root); this.foes.set(f.id, r); }
      applyPose(r, foePose(f, now), f.state === 'strike' || f.state === 'hit' || f.state === 'deflected' ? kFast : k);
      r.root.position.x = f.x; r.root.position.z = f.z; r.root.rotation.y = f.face;
      if (f.state === 'dead') { const s = 1 - es(f.t, 50, 88); r.root.scale.setScalar(Math.max(0.001, s)); }
    }
    for (const [id, r] of this.foes) if (!seen.has(id)) { this.scene.remove(r.root); this.foes.delete(id); }

    // tells: a glint on the weapon as a steel attack is about to land, a jade ring for one that cannot be guarded
    const threat = g.foes.find((f) => (f.state === 'windup' || f.state === 'strike') && f.atk), gm = this.glint.material as T.SpriteMaterial, jm = this.jadeRing.material as T.MeshBasicMaterial;
    if (threat && threat.atk && threat.state === 'windup') {
      const a = threat.atk, u = threat.t / a.windup, r = this.foes.get(threat.id);
      if (r) { r.tip.getWorldPosition(this.glint.position); }
      gm.color.copy(a.jade ? hdr(0.5, 3, 1.8) : hdr(3, 2.2, 1)); gm.opacity = Math.min(1, u * 1.6); this.glint.scale.setScalar(0.5 + Math.pow(u, 3) * 2.2);
      if (a.jade) { this.jadeRing.visible = true; this.jadeRing.position.set(threat.x, 0.06, threat.z); this.jadeRing.scale.setScalar(a.range + 0.35); jm.opacity = 0.25 + u * 0.75; } else this.jadeRing.visible = false;
    } else { gm.opacity = Math.max(0, gm.opacity - dt * 6); jm.opacity = Math.max(0, jm.opacity - dt * 4); if (jm.opacity <= 0) this.jadeRing.visible = false; }
    // the lock-on ring, and a marker over a foe that is open for the finisher
    const tg = g.targetFoe; this.mark.visible = !!tg && g.phase !== 'won';
    if (tg) { const rr = tg.kind === 'bear' ? 1.25 : 0.75; this.mark.position.set(tg.x, 0.05, tg.z); this.mark.scale.setScalar(rr + Math.sin(now * 4) * 0.04); }
    const open = g.living.find((f) => f.state === 'broken'); this.finish.visible = !!open;
    if (open) { this.finish.position.set(open.x, (open.kind === 'bear' ? 3.3 : 2.4) + Math.sin(now * 5) * 0.12, open.z); this.finish.rotation.y = now * 3; }

    // strokes and sparks
    this.trailBox.position.set(g.x, 0, g.z); this.trailBox.rotation.y = g.face;
    this.trails.forEach((m, i) => { const life = (m.userData.life as number) || 0, c = CUTS[i], on = g.state === `cut${i + 1}` && g.t >= c.hit - 3; const l = on ? Math.max(0, life - dt * 3.2) : Math.max(0, life - dt * 6); m.userData.life = l; const show = on && l > 0; m.visible = show; (m.material as T.MeshBasicMaterial).opacity = show ? l : 0; });
    const tl = (this.tagRing.userData.life as number) || 0; if (tl > 0) { const l = Math.max(0, tl - dt * 1.7); this.tagRing.userData.life = l; this.tagRing.visible = l > 0; this.tagRing.scale.setScalar(0.5 + (1 - l) * TAG.radius); (this.tagRing.material as T.MeshBasicMaterial).opacity = l; }
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.life -= dt; const u = Math.max(0, f.life / f.max); (f.mat as T.SpriteMaterial).opacity = u; f.o.scale.setScalar(f.s0 * (1 + (1 - u) * f.grow)); if (f.life <= 0) { this.scene.remove(f.o); f.mat.dispose(); this.fx.splice(i, 1); } }
    for (let i = 0; i < 140; i++) {
      if (this.sLife[i] > 0) { this.sLife[i] -= dt; this.sV[i].y -= 9 * dt; this.sP[i].addScaledVector(this.sV[i], dt); this.dum.position.copy(this.sP[i]); this.dum.lookAt(this.sP[i].x + this.sV[i].x, this.sP[i].y + this.sV[i].y, this.sP[i].z + this.sV[i].z); this.dum.scale.setScalar(Math.max(0, Math.min(1, this.sLife[i] * 3))); }
      else { this.dum.position.set(0, -999, 0); this.dum.scale.setScalar(0); }
      this.dum.updateMatrix(); this.sparks.setMatrixAt(i, this.dum.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = true;
    const rp = this.rainPos; for (let i = 0; i < rp.length / 6; i++) { const j = i * 6; let y = rp[j + 1] - 26 * dt; if (y < -3) y += 22; rp[j + 1] = y; rp[j + 4] = y - 0.6; }
    this.rainG.attributes.position.needsUpdate = true;
    for (const m of this.mists) { m.position.x += (m.userData.v as number) * dt; if (m.position.x > 42) m.position.x = -42; if (m.position.x < -42) m.position.x = 42; }
    this.lamps.forEach((l, i) => { l.intensity = 30 + Math.sin(now * 5 + i * 2) * 3; });

    // camera: behind Dora, looking past her at the target
    const won = g.phase === 'won';
    let want = this.yaw;
    if (won) want = this.yaw + dt * 0.35;
    else if (tg) want = Math.atan2(tg.x - g.x, tg.z - g.z);
    let dy = want - this.yaw; while (dy > PI) dy -= PI * 2; while (dy < -PI) dy += PI * 2;
    this.yaw += dy * (won ? 1 : 1 - Math.exp(-dt * 2.6));
    const dist = (g.phase === 'intro' ? 8.6 : 7.2) + (tg && tg.kind === 'bear' ? 1.2 : 0), h = this.cam.aspect < 1 ? 4.6 : 3.7, side = this.cam.aspect < 1 ? 0.9 : 1.9;
    const cx = g.x - Math.sin(this.yaw) * dist + Math.cos(this.yaw) * side, cz = g.z - Math.cos(this.yaw) * dist - Math.sin(this.yaw) * side;
    const kc = 1 - Math.exp(-dt * 5); this.camPos.x += (cx - this.camPos.x) * kc; this.camPos.y += (h - this.camPos.y) * kc; this.camPos.z += (cz - this.camPos.z) * kc;
    const lx = tg && !won ? mix(g.x, tg.x, 0.5) : g.x, lz = tg && !won ? mix(g.z, tg.z, 0.5) : g.z;
    this.look.x += (lx - this.look.x) * kc; this.look.z += (lz - this.look.z) * kc; this.look.y = 1.25;
    this.cam.position.copy(this.camPos);
    if (this.shake > 0) { this.cam.position.x += (Math.random() - 0.5) * this.shake; this.cam.position.y += (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 0.9); }
    this.cam.lookAt(this.look);
    // a lantern post right in front of the lens would hide the fight
    for (const post of this.posts) post.visible = Math.hypot(post.position.x - this.camPos.x, post.position.z - this.camPos.z) > 4.2;
    if (this.pipe) this.pipe.render(); else this.renderer.render(this.scene, this.cam);
  }
}
