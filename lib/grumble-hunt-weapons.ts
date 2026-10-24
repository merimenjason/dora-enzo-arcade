/** Botanical toy models ported from docs/grumble-hunt/look-test/main.ts.txt. */
import * as T from 'three';
import { poseArms, type HuntChinchilla } from './hunt-chinchilla';
import type { WeaponType } from './grumble-hunt-content';
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
type Pair = { soft: T.Material; toon: T.Material };
export function createHuntWeapons(model: HuntChinchilla, material: (color: number) => T.Material, geometries: Set<T.BufferGeometry>, materials: Set<T.Material>) {
  const held: Partial<Record<WeaponType, T.Group[]>> = {};
  const pair = (color: number): Pair => { const m = material(color); return { soft: m, toon: m }; };
  const mesh = (geo: T.BufferGeometry, p: Pair, parent: T.Object3D) => { geometries.add(geo); const m = new T.Mesh(geo, p.toon); m.castShadow = true; parent.add(m); return m; };
function grip(...parts: [T.BufferGeometry, Pair, number, number, number, number?, number?, number?][]) {
  const g = new T.Group(); model.body.add(g); g.scale.setScalar(1 / 0.75);
  for (const [geo, p, x, y, z, rx = 0, ry = 0, rz = 0] of parts) { const m = mesh(geo, p, g); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); }
  return g;
}
{
  const wood = pair(0xb07a44), dark = pair(0x6e4423), leaf = pair(0x5d9a3f), thistle = pair(0xa77bd6), bubble = pair(0xbfe6ff);
  // Twin Claws: a curved wooden paw-blade in each paw, rounded at the tip
  // a long flattened leaf of pale wood out past the paw, curving up a little, on a dark grip
  const blade = new T.SphereGeometry(1, 16, 10), pale = pair(0xe3b77a);
  held.claws = [-1, 1].map(() => {
    const g = grip([blade, pale, 0.26, 0.05, 0, 0, 0, 0.28], [new T.CylinderGeometry(0.04, 0.04, 0.16, 8), dark, 0.02, 0, 0, 0, 0, Math.PI / 2]);
    g.children[0].scale.set(0.3, 0.075, 0.035); return g;
  });
  // Thistle Lance in the right paw, Leaf Shield on the left
  const shaft = new T.CylinderGeometry(0.03, 0.04, 1.1, 8), puff = new T.IcosahedronGeometry(0.1, 1);
  held.lance = [
    grip([new T.SphereGeometry(1, 16, 12), leaf, 0.06, 0.05, 0, 0, 0, 0], [new T.CylinderGeometry(0.012, 0.012, 0.7, 6), dark, 0.075, 0.05, 0, Math.PI / 2, 0, 0]),
    grip([shaft, wood, 0.35, 0.05, 0, 0, 0, -Math.PI / 2 + 0.25], [puff, thistle, 0.88, 0.2, 0], [new T.SphereGeometry(0.07, 10, 8), leaf, 0.8, 0.18, 0, 0, 0, -Math.PI / 2 + 0.25]),
  ];
  held.lance[0].children[0].scale.set(0.045, 0.26, 0.2);
  // Bubble Wand: a reed stick with a ring, and a bubble drifting off it
  const ring = new T.TorusGeometry(0.1, 0.02, 8, 20);
  const bubbleMat = bubble; for (const m of [bubbleMat.toon]) { m.transparent = true; m.opacity = 0.55; }
  held.wand = [grip([new T.CylinderGeometry(0.022, 0.026, 0.55, 8), pair(0x9fbf5a), 0, 0.22, 0, 0, 0, -0.3], [ring, pair(0xf2c14e), 0.17, 0.53, 0, 0, Math.PI / 2, -0.3], [new T.SphereGeometry(0.11, 16, 12), bubbleMat, 0.38, 0.7, 0])];
  // Pinecone Yo-yo: hangs from the right paw on a string and swings
  const cone = grip([new T.SphereGeometry(0.11, 12, 10), pair(0x8a5a34), 0, -0.24, 0]);
  for (let i = 0; i < 12; i++) { const sc = mesh(new T.ConeGeometry(0.035, 0.07, 6), pair(0x6e4423), cone); const a = i * 2.4, h = -0.24 + ((i % 4) - 1.5) * 0.05; sc.position.set(Math.cos(a) * 0.1, h, Math.sin(a) * 0.1); sc.rotation.z = Math.PI; }
  cone.children[0].scale.set(1, 1.3, 1);
  const lineGeo = new T.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, -0.14, 0)]), lineMat = new T.LineBasicMaterial({ color: 0xf3ead8 }); geometries.add(lineGeo); materials.add(lineMat); cone.add(new T.Line(lineGeo, lineMat));
  held.yoyo = [cone];
  for (const [k, gs] of Object.entries(held)) for (const g of gs) g.visible = false;

}

// Rounded primitives keep the toy silhouettes soft. Grip coordinates below are local to
// these groups; transform them back to body space for the paws every frame.
const idleGrips: Partial<Record<WeaponType, [T.Vector3 | null, T.Vector3 | null]>> = {};
const woodW = pair(0xc39359), paleW = pair(0xe8cca0), greenW = pair(0x6eaa4e), wrapW = pair(0x845638);
function ball(g: T.Group, p: Pair, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const m = mesh(new T.SphereGeometry(1, 20, 14), p, g); m.position.set(x,y,z); m.scale.set(sx,sy,sz); return m;
}
function rod(g: T.Group, a: T.Vector3, b: T.Vector3, r = .028, p = woodW) {
  const m = mesh(new T.CapsuleGeometry(r, Math.max(.001,a.distanceTo(b)-2*r), 4, 10), p, g);
  m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize()); return m;
}
function toy(id: WeaponType, left: T.Vector3 | null, right: T.Vector3 | null) {
  const g = grip(); held[id] = [g]; idleGrips[id] = [left,right]; return g;
}
function wrapped(g: T.Group, a: T.Vector3, b: T.Vector3) {
  rod(g,a,b,.04,wrapW);
  for(let i=1;i<5;i++) { const m=mesh(new T.TorusGeometry(.042,.008,6,12),paleW,g); m.position.copy(a).lerp(b,i/5); m.quaternion.setFromUnitVectors(V(0,0,1),b.clone().sub(a).normalize()); }
}
function shield(g: T.Group, pod = false) {
  const c = V(.64,.26,-.46);
  ball(g,pod?greenW:wrapW,c.x,c.y,c.z,.065,pod?.26:.21,pod?.14:.21);
  if(pod) for(let i=0;i<3;i++) ball(g,paleW,c.x+.06,c.y+(i-1)*.13,c.z,.035,.065,.075);
  else { ball(g,woodW,c.x+.05,c.y,c.z,.035,.16,.16); rod(g,V(c.x,c.y+.2,c.z),V(c.x,c.y+.26,c.z),.025); }
  rod(g,V(c.x-.08,c.y-.05,c.z),V(c.x-.08,c.y+.06,c.z),.035,wrapW);
}
{
  let g=toy('greatsword',V(.12,.20,0),V(0,0,0));
  wrapped(g,V(0,-.08,0),V(.18,.30,0));
  ball(g,paleW,-.19,.71,0,.21,.63,.065).rotation.z=-.58;
  for(let i=0;i<3;i++) rod(g,V(-.26+i*.065,.47, .064),V(-.45+i*.065,.89,.064),.009,woodW);
  g.position.set(.48,.49,.80); g.rotation.set(0,Math.PI/2,.5);
  g=toy('katana',V(0,.16,0),V(0,0,0)); wrapped(g,V(0,-.08,0),V(0,.22,0));
  ball(g,greenW,0,.26,0,.13,.035,.13);
  const curve=new T.QuadraticBezierCurve3(V(0,.28,0),V(.02,.65,0),V(.18,.98,0));
  const blade=mesh(new T.TubeGeometry(curve,24,.045,10,false),greenW,g); blade.scale.z=.55;
  ball(g,greenW,.18,.98,0,.045,.045,.025);
  for(let i=0;i<3;i++) ball(g,paleW,.015+i*.035,.42+i*.19,0,.05,.018,.03);
  g.position.set(.78,.38,.68); g.rotation.set(.38,0,-.28);
  for(const id of ['sword','chargeblade'] as WeaponType[]) {
    g=toy(id,V(.56,.26,-.46),V(.65,.38,.62)); shield(g,id==='chargeblade');
    wrapped(g,V(.65,.30,.62),V(.65,.46,.62));
    const b=ball(g,id==='sword'?woodW:greenW,.70,.64,.70,.085,.24,.045); b.rotation.set(.35,0,-.25);
    if(id==='chargeblade') for(let i=0;i<3;i++) ball(g,paleW,.72,.52+i*.10,.68+i*.035,.04,.035,.018);
  }
  g=toy('horn',V(0,.16,0),V(0,0,0)); wrapped(g,V(0,-.08,0),V(0,.24,0));
  ball(g,pair(0xd8ae54),0,.48,0,.23,.27,.20); ball(g,woodW,.02,.70,0,.09,.10,.09);
  for(let i=0;i<3;i++) ball(g,wrapW,.205,.36+i*.11,.04,.025,.028,.04);
  g.position.set(.72,-.12,.80); g.rotation.set(.3,0,-.35);
  g=toy('gunlance',V(.60,.30,-.68),V(.58,.40,.40));
  ball(g,greenW,.68,.30,-.68,.065,.23,.17); rod(g,V(.60,.20,-.68),V(.60,.40,-.68),.025,wrapW); rod(g,V(.47,.40,.40),V(1.34,.55,.40),.045);
  ball(g,pair(0xf4d6ae),1.35,.56,.40,.20,.17,.17);
  for(let i=0;i<5;i++) ball(g,paleW,1.39+Math.sin(i*2)*.10,.59+Math.cos(i*2)*.10,.54,.035,.035,.02);
  g=toy('switchaxe',V(0,.22,0),V(0,0,0)); wrapped(g,V(0,-.12,0),V(0,.35,0)); rod(g,V(0,.3,0),V(0,.70,0));
  ball(g,pair(0xe6a7bc),0,.64,0,.10,.10,.10); ball(g,woodW,0,.87,0,.22,.22,.065);
  ball(g,paleW,0,.91,.06,.16,.13,.022); g.position.set(.65,.36,.70); g.rotation.set(.35,0,-.25);
  g=toy('glaive',V(0,.24,0),V(0,0,0)); rod(g,V(0,-.28,0),V(0,.90,0));
  for(let i=0;i<5;i++) {const a=i*Math.PI*2/5;ball(g,pair(0xf0b4cd),Math.cos(a)*.10,.91,Math.sin(a)*.10,.07,.14,.07);}
  ball(g,pair(0xffdf74),0,.89,0,.08,.09,.08); g.position.set(.66,.35,.72); g.rotation.x=.3;
  const glow=new T.MeshBasicMaterial({color:0xfff18c,toneMapped:false}); glow.userData.outlineParameters={visible:false};
  materials.add(glow); const flyGeo=new T.SphereGeometry(.04,12,8); geometries.add(flyGeo); const fly=new T.Mesh(flyGeo,glow); g.add(fly); g.userData.firefly=fly;
  for(const z of [-.04,.04]) { const wing=new T.Mesh(flyGeo,glow);wing.scale.set(1,.3,1);wing.position.z=z;fly.add(wing); }
  g=toy('lightbow',V(0,0,0),V(-.23,.12,.18));
  rod(g,V(0,-.10,0),V(0,.12,0),.04); rod(g,V(0,.10,0),V(0,.31,-.13),.035);rod(g,V(0,.10,0),V(0,.31,.13),.035);
  rod(g,V(0,.31,-.13),V(-.23,.12,.18),.012,paleW);rod(g,V(0,.31,.13),V(-.23,.12,.18),.012,paleW);
  ball(g,wrapW,-.23,.12,.18,.05,.035,.035);g.position.set(.84,.39,-.30);
  g=toy('heavybow',V(.10,-.10,-.15),V(-.12,.11,.12));
  const pumpkin=pair(0xe4a04c);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ball(g,pumpkin,0,Math.cos(a)*.08,Math.sin(a)*.08,.25,.15,.15);}
  ball(g,wrapW,.235,0,0,.018,.095,.095);ball(g,paleW,.25,0,0,.015,.065,.065);
  rod(g,V(-.12,.08,.12),V(-.12,.20,.12),.04,greenW);rod(g,V(.10,-.10,-.15),V(.10,-.10,.08),.04);
  g.position.set(.75,.38,.38);
  g=toy('bow',V(0,0,0),V(-.18,0,.18));
  const arc=new T.QuadraticBezierCurve3(V(0,-.34,0),V(.25,0,0),V(0,.34,0));
  mesh(new T.TubeGeometry(arc,24,.025,10,false),woodW,g);
  rod(g,V(0,-.34,0),V(-.18,0,.18),.009,paleW);rod(g,V(-.18,0,.18),V(0,.34,0),.009,paleW);
  g.position.set(.83,.45,-.31);
}

  // Attack motion: a quick wind-up, the strike around contact (0.1 s), then an eased return to rest.
  const ease = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const fastTypes: WeaponType[] = ['claws', 'sword', 'glaive', 'lightbow'];
  function strike(type: WeaponType, swing: number, delay = 0) {
    if (swing < 0) return 0;
    const u = (swing - delay) / (fastTypes.includes(type) ? 0.2 : 0.4);
    return u < 0 ? 0 : u < 0.2 ? -0.35 * ease(u / 0.2) : u < 0.4 ? -0.35 + 1.35 * ease((u - 0.2) / 0.2) : 1 - ease((u - 0.4) / 0.6);
  }
  // Swings turn each toy around its own handle in body space (x forward, y up, z the right-paw side).
  const SWINGS: Partial<Record<WeaponType, { axis: T.Vector3; angle: number; reach?: T.Vector3 }>> = {
    greatsword: { axis: V(0, 0, 1), angle: -1.5 }, katana: { axis: V(0.45, 0, 1).normalize(), angle: -1.7 }, switchaxe: { axis: V(0, 0, 1), angle: -1.4 },
    horn: { axis: V(0, 0, 1), angle: -1.1 }, glaive: { axis: V(1, 0, 0.3).normalize(), angle: 1.3 },
    sword: { axis: V(0, 0, 1), angle: 0, reach: V(0.28, 0.05, 0) }, chargeblade: { axis: V(0, 0, 1), angle: 0, reach: V(0.28, 0.05, 0) },
    gunlance: { axis: V(0, 0, 1), angle: 0, reach: V(0.45, 0, 0) },
    bow: { axis: V(0, 0, 1), angle: 0.25, reach: V(-0.12, 0, 0) }, lightbow: { axis: V(0, 0, 1), angle: 0.2, reach: V(-0.1, 0, 0) }, heavybow: { axis: V(0, 0, 1), angle: 0.35, reach: V(-0.2, 0.04, 0) },
  };
  const turn = new T.Quaternion();

  return {
    pose(type: WeaponType, time: number, swing: number) {
      for (const [id, groups] of Object.entries(held)) for (const g of groups) g.visible = id === type;
      const groups = held[type]; if (!groups) return;
      const bob = Math.sin(time * 2) * 0.015, k = strike(type, swing);
      const grips = idleGrips[type];
      if (grips) {
        const g = groups[0], move = SWINGS[type];
        g.userData.restPos ??= g.position.clone(); g.userData.restQ ??= g.quaternion.clone();
        g.position.copy(g.userData.restPos); g.quaternion.copy(g.userData.restQ);
        if (move) { g.quaternion.premultiply(turn.setFromAxisAngle(move.axis, move.angle * k)); if (move.reach) g.position.addScaledVector(move.reach, Math.max(0, k)); }
        g.updateMatrix();
        poseArms(model, ...grips.map((p) => p ? p.clone().applyMatrix4(g.matrix) : null) as [T.Vector3 | null, T.Vector3 | null]);
        const fly = g.userData.firefly as T.Mesh | undefined; if (fly) fly.position.copy(V(.34 + Math.cos(time * 2) * .85, 1.7, Math.sin(time * 2) * .85).applyMatrix4(g.matrix.clone().invert()));
      } else if (type === 'claws') {
        // Left then right jab.
        const l = V(.62 + .3 * Math.max(0, k), .55 + bob, -.26), r = V(.62 + .3 * Math.max(0, strike(type, swing, 0.06)), .55 - bob, .26); poseArms(model, l, r); groups[0].position.copy(l); groups[1].position.copy(r);
      } else if (type === 'lance') {
        const l = V(.52, .22 + bob, -.72), r = V(.48 + .45 * k, .46, .34); poseArms(model, l, r); groups[0].position.copy(l); groups[1].position.copy(r);
      } else if (type === 'yoyo') {
        // Thrown out along the string and reeled back in.
        const r = V(.62, .78 + bob, .42), out = Math.max(0, k); poseArms(model, null, r.clone().add(V(.15 * out, 0, 0)));
        groups[0].position.copy(r).add(V(1.1 * out, -.25 * out, 0)); groups[0].rotation.z = Math.sin(time * 1.7) * .25 - out * 6;
      } else {
        const r = V(.56 + .12 * Math.max(0, k), .58 + bob, .32); poseArms(model, null, r); groups[0].position.copy(r); groups[0].rotation.z = -1.1 * k;
      }
    },
  };
}
