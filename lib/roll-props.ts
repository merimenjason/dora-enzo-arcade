// Fluff Roll props: little vertex-coloured toys, garden things and meadow friends.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Kind } from './roll-game';

export const PROP_KIND_IDS = [
  'ladybird', 'beetle', 'golden', 'mouse', 'duckling', 'seed', 'crumb', 'clover', 'pebble',
  'raisin', 'blueberry', 'button', 'acorn', 'hazelnut', 'puff', 'daisy', 'cube', 'pinecone',
  'reel', 'mushroom', 'block', 'apple', 'chew', 'teacup', 'carrot', 'hay', 'sock', 'wicker',
  'pot', 'slipper', 'can', 'cushion', 'tub', 'cabbage', 'bucket', 'sunflower', 'flag',
  'hedgehog', 'pumpkin', 'birdbath', 'crate', 'chair', 'duck', 'bale', 'barrow', 'bench',
  'bush', 'barrel', 'bristle', 'cart', 'haystack', 'tree', 'shed', 'windmill', 'barn',
  'tractor', 'silo', 'oak', 'farmhouse', 'hill',
] as const;

function part(g: THREE.BufferGeometry, color: number, m: THREE.Matrix4) {
  const n = g.index ? g.toNonIndexed() : g;
  if (n !== g) g.dispose();
  n.applyMatrix4(m);
  for (const name of Object.keys(n.attributes)) if (name !== 'position' && name !== 'normal') n.deleteAttribute(name);
  const c = new THREE.Color(color), count = n.getAttribute('position').count, colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
  n.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return n;
}
const at = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/** Own-size geometry, grounded at zero; all animals look along +x. Caller owns the result. */
export function propGeometry(k: Kind): THREE.BufferGeometry | null {
  if (!(PROP_KIND_IDS as readonly string[]).includes(k.id)) return null;
  const parts: THREE.BufferGeometry[] = [], c = k.color, a = k.accent ?? k.color;
  const cream = 0xfff1dc, dark = 0x302721, green = 0x5f9a3a, wood = 0x98623c;
  // Work in a small modelling space; the final radial fit includes handles, tails and sails.
  const add = (g: THREE.BufferGeometry, col: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
    parts.push(part(g, col, at(x, y, z, sx, sy, sz, rx, ry, rz)));
  const ball = (col: number, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) => add(new THREE.IcosahedronGeometry(1, 0), col, x, y, z, sx, sy, sz);
  const box = (col: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rz = 0) => add(new THREE.BoxGeometry(1, 1, 1), col, x, y, z, sx, sy, sz, 0, 0, rz);
  const cyl = (col: number, x: number, y: number, z: number, radius: number, height: number, bottom = radius, rz = 0) => add(new THREE.CylinderGeometry(radius, bottom, height, 8), col, x, y, z, 1, 1, 1, 0, 0, rz);
  const cone = (col: number, x: number, y: number, z: number, radius: number, height: number, rz = 0) => add(new THREE.ConeGeometry(radius, height, 5), col, x, y, z, 1, 1, 1, 0, 0, rz);
  const ring = (col: number, x: number, y: number, z: number, radius: number, tube: number, rx = 0, ry = 0, arc = Math.PI * 2) => add(new THREE.TorusGeometry(radius, tube, 3, 10, arc), col, x, y, z, 1, 1, 1, rx, ry);
  const leaf = (col: number, x: number, y: number, z: number, angle = 0) => add(new THREE.OctahedronGeometry(1), col, x, y, z, .3, .07, .13, 0, angle, -.4);
  const eyes = (x: number, y: number, z: number) => { for (const s of [-1, 1]) ball(dark, x, y, s * z, .045); };
  const legs = (col: number, y = .22) => { for (const x of [-.45, .45]) for (const z of [-.35, .35]) box(col, x, y, z, .12, y * 2, .12); };
  const apple = (x: number, y: number, z: number, scale = 1, col = c) => { ball(col, x, y, z, .35 * scale, .32 * scale, .33 * scale); box(wood, x, y + .34 * scale, z, .05 * scale, .15 * scale, .05 * scale); leaf(green, x + .12 * scale, y + .36 * scale, z); };
  const flower = (col: number, x: number, y: number, z: number, size: number) => { for (let i = 0; i < 5; i++) { const t = i * Math.PI * 2 / 5; add(new THREE.OctahedronGeometry(1), col, x + Math.cos(t) * size, y + Math.sin(t) * size, z, size * .65, size * .65, size * .3); } ball(0xb17932, x, y, z + size * .2, size * .65); };
  const bowl = (col: number, y: number, radius: number, height: number) => {
    // Open wall, inward-facing lining and a recessed bottom: no opaque lid across the rim.
    add(new THREE.CylinderGeometry(radius, radius * .72, height, 8, 1, true), col, 0, y, 0);
    const inside = new THREE.CylinderGeometry(radius * .9, radius * .65, height * .85, 8, 1, true);
    // Reverse winding and normals so the lining is visible from inside.
    const inner = inside.toNonIndexed(); inside.dispose();
    for (const name of ['position', 'normal']) { const attr = inner.getAttribute(name); for (let i = 0; i < attr.count; i += 3) for (let j = 0; j < 3; j++) { const tmp = attr.array[(i + 1) * 3 + j]; attr.array[(i + 1) * 3 + j] = attr.array[(i + 2) * 3 + j]; attr.array[(i + 2) * 3 + j] = tmp; } }
    const normals = inner.getAttribute('normal'); for (let i = 0; i < normals.array.length; i++) normals.array[i] *= -1;
    add(inner, col, 0, y + height * .06, 0);
    cyl(col, 0, y - height * .42, 0, radius * .73, height * .08);
    ring(col, 0, y + height / 2, 0, radius, .035, Math.PI / 2);
  };
  switch (k.id) {
    case 'ladybird': case 'beetle':
      ball(c, -.1, .3, 0, .65, .3, .48); ball(a, .55, .25, 0, .26, .22, .28);
      box(dark, -.1, .57, 0, .9, .025, .025);
      for (const z of [-.3, .3]) for (const x of [-.4, .1]) add(new THREE.TetrahedronGeometry(.09), dark, x, .51, z);
      for (const z of [-.42, .42]) for (const x of [-.35, 0, .35]) box(dark, x, .13, z, .07, .08, .35, z > 0 ? -.3 : .3);
      break;
    case 'golden': case 'acorn':
      ball(c, 0, .42, 0, .43, .55, .43); cyl(a, 0, .78, 0, .47, .23, .4); box(wood, 0, .98, 0, .09, .2, .09); break;
    case 'mouse':
      ball(c, -.1, .32, 0, .6, .32, .32); ball(c, .48, .38, 0, .35, .26, .25);
      for (const z of [-.22, .22]) { ball(c, .35, .66, z, .2, .24, .09); ball(a, .37, .68, z * 1.12, .12, .15, .04); }
      eyes(.63, .49, .19); ball(0xdc9e9f, .8, .35, 0, .08); ring(0xdc9e9f, -.8, .12, .12, .3, .025, Math.PI / 2, 0, Math.PI * 1.5); break;
    case 'duck': case 'duckling':
      ball(c, -.2, .38, 0, .6, .38, .4); ball(c, .34, .78, 0, .32); box(a, .69, .72, 0, .4, .12, .3);
      for (const z of [-.38, .38]) ball(c, -.22, .45, z, .38, .22, .12);
      eyes(.5, .87, .25); for (const z of [-.22, .22]) box(a, .05, .04, z, .4, .08, .23); cone(c, -.73, .5, 0, .16, .4, .9); break;
    case 'seed': ball(c, 0, .16, 0, .65, .16, .3); box(a, 0, .3, 0, .85, .02, .05); break;
    case 'crumb': case 'cube': box(c, 0, .4, 0, .8, .8, .8); break;
    case 'clover': for (let i = 0; i < 3; i++) { const t = i * Math.PI * 2 / 3; ball(c, Math.cos(t) * .3, .06, Math.sin(t) * .3, .35, .06, .3); } break;
    case 'pebble': case 'raisin': case 'hazelnut': ball(c, 0, .4, 0, .6, .4, .48); if (k.id === 'hazelnut') cone(cream, 0, .77, 0, .14, .15); break;
    case 'blueberry': ball(c, 0, .5, 0, .5); for (let i = 0; i < 5; i++) { const t = i * Math.PI * 2 / 5; cone(dark, Math.cos(t) * .12, .95, Math.sin(t) * .12, .06, .12); } break;
    case 'button': cyl(c, 0, .06, 0, .55, .12); for (const x of [-.15, .15]) for (const z of [-.15, .15]) box(dark, x, .125, z, .08, .01, .08); break;
    case 'puff': case 'daisy': case 'sunflower':
      cyl(green, 0, .6, 0, .035, 1.2); if (k.id !== 'puff') { leaf(green, -.15, .5, 0); flower(c, 0, 1.25, 0, .25); } else ball(c, 0, 1.25, 0, .4);
      break;
    case 'pinecone': for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) { const t = (i + j * .5) * Math.PI * 2 / 5; cone(c, Math.cos(t) * (.32 - j * .06), .18 + j * .2, Math.sin(t) * (.32 - j * .06), .19 - j * .025, .3); } break;
    case 'reel': cyl(c, 0, .35, 0, .3, .6); for (const y of [.06, .68]) cyl(a, 0, y, 0, .5, .12); for (const y of [.2, .35, .5]) ring(cream, 0, y, 0, .31, .025, Math.PI / 2); break;
    case 'mushroom':
      cyl(a, 0, .3, 0, .17, .6, .23); add(new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), c, 0, .62, 0, .6, .38, .6); cyl(a, 0, .62, 0, .6, .035);
      for (let i = 0; i < 5; i++) { const t = i * Math.PI * 2 / 5; ball(a, Math.cos(t) * .35, .9, Math.sin(t) * .35, .1, .035, .1); } break;
    case 'block':
      box(c, 0, .5, 0, 1, 1, 1); box(a, 0, .5, .505, .8, .8, .025);
      box(c, -.15, .5, .525, .08, .55, .02, -.3); box(c, .15, .5, .525, .08, .55, .02, .3); box(c, 0, .45, .53, .3, .07, .02); break;
    case 'apple': apple(0, .35, 0); break;
    case 'chew': cyl(c, 0, .15, 0, .15, 1.5, .13, Math.PI / 2); for (const x of [-.55, .55]) box(cream, x, .26, 0, .08, .03, .15); break;
    case 'teacup': bowl(c, .43, .48, .65); cyl(a, 0, .04, 0, .75, .08); ring(a, .53, .47, 0, .24, .06); break;
    case 'carrot': cone(c, -.1, .22, 0, .23, 1.15, -Math.PI / 2); for (let i = -1; i <= 1; i++) leaf(a, .6, .3 + i * .08, i * .13, i * .6); break;
    case 'hay': case 'haystack': for (let i = 0; i < 7; i++) { const t = i * Math.PI * 2 / 7; cone(i % 2 ? c : 0xcfaa51, Math.cos(t) * .25, .5, Math.sin(t) * .25, .43, 1 + i % 2 * .15); } break;
    case 'sock':
      ball(c, -.15, .2, 0, .65, .2, .26); ball(a, .44, .19, 0, .25, .19, .26); ball(c, -.55, .3, 0, .24, .3, .26); box(c, -.53, .6, 0, .38, .65, .46);
      for (const y of [.65, .79]) box(a, -.53, y, 0, .4, .065, .48); break;
    case 'wicker':
      ball(c, 0, .55, 0, .52); for (let i = 0; i < 4; i++) ring(i % 2 ? wood : c, 0, .55, 0, .53, .045, 0, i * Math.PI / 4); for (const y of [.3, .8]) ring(cream, 0, y, 0, .46, .035, Math.PI / 2); break;
    case 'pot': bowl(c, .35, .5, .7); cyl(wood, 0, .61, 0, .44, .04); cyl(green, 0, .9, 0, .035, .6); leaf(a, -.16, .95, 0); flower(0xf4b2cd, 0, 1.3, 0, .18); break;
    case 'slipper': ball(c, 0, .2, 0, .8, .2, .4); ball(a, -.34, .35, 0, .38, .07, .28); ring(a, -.35, .36, 0, .24, .06, Math.PI / 2); break;
    case 'can': bowl(c, .4, .42, .8); ring(c, -.48, .58, 0, .35, .065); cyl(c, .55, .51, 0, .1, .85, .16, -.8); cyl(cream, .86, .8, 0, .2, .08, .2, -.8); break;
    case 'cushion': ball(c, 0, .25, 0, .8, .25, .65); box(a, 0, .25, 0, 1.35, .035, 1.1); ball(a, 0, .49, 0, .06, .025, .06); break;
    case 'tub': bowl(c, .25, .85, .5); cyl(a, 0, .18, 0, .7, .1); break;
    case 'cabbage':
      ball(c, 0, .5, 0, .5); for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; ball(i % 2 ? c : 0x70a54e, Math.cos(t) * .32, .36, Math.sin(t) * .32, .32, .39, .28); } break;
    case 'bucket': bowl(c, .35, .5, .7); ring(0xccccbb, 0, .71, 0, .5, .035, 0, 0, Math.PI); break;
    case 'flag': cyl(a, 0, .8, 0, .025, 1.6); box(c, .28, 1.43, 0, .55, .34, .025); cyl(green, 0, .02, 0, .4, .04); break;
    case 'hedgehog': case 'bristle': {
      const boar = k.id === 'bristle'; ball(c, -.12, .45, 0, .65, .45, .46); ball(a, .5, .35, 0, .4, .3, .3); ball(boar ? 0xbc8b80 : dark, .82, .32, 0, .17, .12, .18);
      if (boar) { legs(c, .15); eyes(.65, .49, .24); for (const z of [-.25, .25]) { cone(c, .35, .76, z, .15, .25); cone(cream, .76, .27, z, .055, .25, -.4); } ring(c, -.78, .45, 0, .13, .035); }
      else for (const z of [-.22, .22]) box(dark, .65, .47, z, .13, .025, .025, -.2);
      for (let i = 0; i < 18; i++) { const t = i * 2.4, radius = .4 * Math.sqrt((i + .5) / 18); cone(i % 3 ? c : a, -.18 + Math.cos(t) * radius, .72 + .14 * (1 - radius), Math.sin(t) * radius, .13, boar ? .3 : .35, Math.cos(t) * .4); } break;
    }
    case 'pumpkin': for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; ball(i % 2 ? c : 0xd87523, Math.cos(t) * .26, .4, Math.sin(t) * .26, .32, .4, .32); } cyl(a, 0, .86, 0, .08, .2); leaf(a, .15, .85, 0); break;
    case 'birdbath': cyl(c, 0, .06, 0, .45, .12); cyl(c, 0, .5, 0, .14, .9, .24); bowl(c, 1, .65, .25); cyl(a, 0, 1.02, 0, .55, .025); break;
    case 'crate':
      box(c, 0, .04, 0, 1.2, .08, .9); for (const x of [-.55, .55]) for (const z of [-.4, .4]) box(wood, x, .35, z, .09, .7, .09);
      for (const y of [.18, .4, .62]) { for (const z of [-.45, .45]) box(c, 0, y, z, 1.2, .14, .06); for (const x of [-.6, .6]) box(c, x, y, 0, .06, .14, .9); }
      for (const x of [-.32, .3]) for (const z of [-.22, .22]) apple(x, .57, z, .65, a); break;
    case 'chair': case 'bench':
      legs(k.id === 'chair' ? a : dark, .3); for (const z of [-.3, 0, .3]) box(c, 0, .62, z, 1.4, .1, .2);
      for (const x of [-.6, .6]) box(c, x, .9, -.4, .1, .7, .1); for (const y of [.88, 1.14]) box(c, 0, y, -.4, 1.4, .16, .08);
      if (k.id === 'chair') for (const x of [-.65, .65]) box(a, x, .85, 0, .12, .08, .8); break;
    case 'bale': box(c, 0, .4, 0, 1.5, .8, 1); for (const x of [-.45, .45]) { box(a, x, .81, 0, .08, .025, 1.02); for (const z of [-.51, .51]) box(a, x, .4, z, .08, .8, .025); } break;
    case 'barrow':
      add(new THREE.CylinderGeometry(.65, .4, .4, 4), c, 0, .66, 0, 1.2, 1, .85, 0, Math.PI / 4); for (const z of [-.36, .36]) { box(a, -.3, .42, z, 1.5, .08, .08, -.16); box(a, -.15, .2, z, .08, .4, .08); }
      add(new THREE.CylinderGeometry(.27, .27, .18, 8), a, .67, .27, 0, 1, 1, 1, Math.PI / 2); ball(cream, .67, .27, .1, .07); break;
    case 'bush': ball(c, 0, .55, 0, .75, .55, .7); for (let i = 0; i < 5; i++) { const t = i * 2.4; flower(a, Math.cos(t) * .5, .65 + Math.sin(t) * .25, .48, .09); } break;
    case 'barrel': cyl(c, 0, .5, 0, .45, 1, .45); ball(c, 0, .5, 0, .52, .49, .52); for (const y of [.12, .5, .88]) ring(a, 0, y, 0, y === .5 ? .52 : .46, .04, Math.PI / 2); cyl(0x536f83, 0, 1.01, 0, .39, .025); break;
    case 'cart':
      box(c, 0, .4, 0, 1.4, .14, 1); for (const z of [-.5, .5]) for (const y of [.65, .9]) box(c, 0, y, z, 1.5, .15, .07);
      for (const x of [-.48, .48]) for (const z of [-.6, .6]) { add(new THREE.CylinderGeometry(.26, .26, .12, 8), dark, x, .26, z, 1, 1, 1, Math.PI / 2); ball(wood, x, .26, z * 1.12, .1); }
      for (const x of [-.38, .3]) box(a, x, .88, 0, .65, .65, .85); box(wood, 1.1, .4, 0, .9, .08, .08); break;
    case 'oak': case 'tree': cyl(a, 0, .65, 0, .12, 1.3, .22); for (const x of [-.4, .4]) cyl(a, x / 2, 1.12, 0, .07, .65, .1, -x); for (const x of [-.42, .1, .48]) ball(c, x, 1.7 + (x === .1 ? .3 : 0), 0, .6, .6, .55); for (let i = 0; i < 7; i++) { const t = i * 2.4; ball(0xd9493e, Math.cos(t) * .63, 1.65 + Math.sin(t) * .4, .42, .1); } break;
    case 'farmhouse': case 'shed': case 'barn': {
      box(c, 0, .55, 0, 1.4, 1.1, 1.2);
      // A triangular prism fills the gable; two planks form the pitched roof.
      add(new THREE.CylinderGeometry(1, 1, 1.3, 3), c, 0, 1.1, 0, .81, 1, .5, Math.PI / 2);
      for (const x of [-.4, .4]) box(k.id === 'barn' ? 0x744239 : a, x, 1.38, 0, .98, .1, 1.4, x < 0 ? .5 : -.5);
      box(wood, 0, .42, .615, .64, .84, .035); for (const x of [-.35, .35]) box(a, x, .44, .645, .055, .88, .04); box(a, 0, .88, .645, .76, .06, .04);
      for (const s of [-1, 1]) box(a, 0, .43, .65, .055, .98, .035, s * .63);
      for (const x of [-.53, .53]) { box(a, x, .82, .62, .24, .28, .04); box(0x82b7cf, x, .82, .65, .16, .19, .025); }
      if (k.id === 'barn') box(a, 0, 1.15, .67, .24, .21, .04); break;
    }
    case 'hill': add(new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), c, 0, 0, 0, 1, .7, 1); break;
    case 'silo': cyl(c, 0, 1.1, 0, .5, 2.2); cone(a, 0, 2.35, 0, .55, .3); for (const y of [.25, .8, 1.35, 1.9]) ring(a, 0, y, 0, .505, .025, Math.PI / 2); for (const x of [-.12, .12]) box(wood, x, 1.1, .52, .025, 2.2, .025); for (let i = 0; i < 10; i++) box(wood, 0, .12 + i * .21, .54, .24, .025, .025); break;
    case 'tractor':
      box(c, 0, .46, 0, 1.3, .3, .65); box(c, .35, .75, 0, .7, .4, .6); box(dark, -.4, .78, 0, .3, .12, .35); box(c, -.5, 1.05, 0, .12, .5, .4);
      for (const z of [-.45, .45]) for (const x of [-.48, .52]) { const radius = x < 0 ? .4 : .26; add(new THREE.CylinderGeometry(radius, radius, .2, 10), a, x, radius, z, 1, 1, 1, Math.PI / 2); add(new THREE.CylinderGeometry(radius * .45, radius * .45, .21, 8), cream, x, radius, z, 1, 1, 1, Math.PI / 2); }
      cyl(dark, .42, 1.18, .2, .045, .5); box(cream, .71, .74, 0, .025, .2, .4); break;
    case 'windmill':
      cyl(c, 0, .9, 0, .35, 1.8, .6); cone(wood, 0, 1.95, 0, .48, .4); ball(a, 0, 1.55, .42, .13);
      for (let i = 0; i < 4; i++) { const t = Math.PI / 4 + i * Math.PI / 2; box(wood, Math.cos(t) * .5, 1.55 + Math.sin(t) * .5, .47, 1, .06, .06, t); box(a, Math.cos(t) * .67, 1.55 + Math.sin(t) * .67, .49, .62, .2, .04, t); }
      box(wood, 0, .3, .55, .24, .6, .04); break;
  }
  let merged: THREE.BufferGeometry | null;
  try { merged = mergeGeometries(parts); } finally { for (const p of parts) p.dispose(); }
  if (!merged) return null;
  merged.computeBoundingBox();
  const bounds = merged.boundingBox!, height = bounds.max.y - bounds.min.y;
  merged.translate(0, -bounds.min.y, 0);
  const positions = merged.getAttribute('position'); let radius = 0;
  for (let i = 0; i < positions.count; i++) radius = Math.max(radius, Math.hypot(positions.getX(i), positions.getZ(i)));
  merged.scale(k.r / radius, k.h / height, k.r / radius);
  merged.computeBoundingBox(); merged.computeBoundingSphere();
  return merged;
}
