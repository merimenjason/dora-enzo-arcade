import * as T from 'three';
import {createChinchilla,animateChinchilla,poseChinchillaPaws,type Chinchilla} from './chinchilla';
import type {CheckpointGame,Species} from './checkpoint-game';

const EXIT_Z=-1.55;   // lane the approved traveler uses to leave through the gate
const SPECIES_COLOR:Record<Species,number>={chinchilla:0xb8adbb,viscacha:0xc9bfa7,fox:0xd08b52,owl:0xbfb0d8,viper:0xa9bf72};

// A small border booth rendered in 3D: Dora inspects at the window, Enzo works
// behind her, and each traveler walks up the queue line to be judged.
export class CheckpointScene{
 scene=new T.Scene();camera=new T.PerspectiveCamera(42,1,.1,120);renderer:T.WebGLRenderer;
 dora:Chinchilla;enzo:Chinchilla;
 traveler=new T.Group();travelerBody:T.Group|null=null;species:Species|null=null;
 stamp=new T.Group();lamp:T.Mesh;gate:T.Group=new T.Group();
 walk=0;exitWalk=0;exitLane=0;verdict:'none'|'approved'|'denied'=('none');verdictTime=0;stampTime=0;shake=0;queue:T.Group[]=[];
 constructor(public canvas:HTMLCanvasElement){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  this.renderer.toneMapping=T.ACESFilmicToneMapping;
  this.scene.background=new T.Color('#171620');this.scene.fog=new T.Fog('#171620',22,58);
  this.scene.add(new T.HemisphereLight(0x8ea6d6,0x2b2230,1.5));
  const key=new T.DirectionalLight(0xffd9a8,2.2);key.position.set(-4,7,6);this.scene.add(key);
  const rim=new T.DirectionalLight(0x9db7ff,1.2);rim.position.set(5,4,-5);this.scene.add(rim);

  this.box(this.scene,0,-.25,0,44,.5,34,0x3d3947);                        // ground
  for(let z=-9;z<=-1.6;z+=1.1)this.box(this.scene,0,.02,z,.7,.02,.5,0xc7b98e); // queue line

  // Booth: real walls with an open service window facing the traveler.
  this.box(this.scene,0,1.4,3.55,3.3,2.8,.12,0x3a3040);                    // back wall
  for(const x of [-1.6,1.6])this.box(this.scene,x,1.4,2.1,.12,2.8,3.1,0x453a4a);
  this.box(this.scene,0,.45,.78,3.3,.9,.16,0x6a5a64);                      // below the window
  this.box(this.scene,0,2.45,.65,3.3,.7,.14,0x6a5a64);                     // lintel
  for(const x of [-1.35,1.35])this.box(this.scene,x,1.5,.65,.6,1.3,.14,0x6a5a64); // pillars
  this.box(this.scene,0,2.92,2.1,3.7,.22,3.5,0x74636e);                    // roof
  this.box(this.scene,0,.55,2.1,3.2,.1,3,0x463c48);                         // inner floor
  this.box(this.scene,0,.95,.72,3.3,.1,.28,0xa08e6f);                     // counter sill
  this.box(this.scene,.05,.9,1.55,3,.1,1.5,0x8a7358);                   // desk behind the sill

  // Documents sitting on the sill, in reach of the window.
  this.permit=this.box(this.scene,-.62,.96,1.15,.7,.02,.46,0xe8dfc9);this.permit.rotation.y=.16;
  this.card=this.box(this.scene,.32,.96,1.15,.6,.02,.4,0xd9cdb0);this.card.rotation.y=-.13;
  this.seal=this.box(this.scene,-.4,.976,1.05,.1,.012,.1,0xc9a23d);

  // Scale outside the window, on the traveler's side.
  this.scaleTop=this.box(this.scene,1.5,.55,-.55,.85,.1,.85,0x8f97a6);
  this.box(this.scene,1.5,.3,-.55,.32,.4,.32,0x646b7a);

  // Two stamps on the sill.
  this.box(this.stamp,0,.14,0,.28,.26,.28,0x5f9c6c);this.box(this.stamp,0,.34,0,.09,.28,.09,0x3f3a44);
  this.stamp.position.set(1.15,.95,1.2);this.scene.add(this.stamp);
  const denyStamp=new T.Group();this.box(denyStamp,0,.14,0,.28,.26,.28,0xb35a51);this.box(denyStamp,0,.34,0,.09,.28,.09,0x3f3a44);
  denyStamp.position.set(-1.35,.95,1.2);this.scene.add(denyStamp);this.denyStamp=denyStamp;

  // Gate arm across the queue.
  this.box(this.gate,0,0,-1.2,.12,.12,2.4,0xd9d2c4);
  for(let i=0;i<3;i++)this.box(this.gate,0,.001,-.45-i*.8,.14,.14,.4,0xb2554c);
  this.gate.position.set(2.2,1.25,.4);this.scene.add(this.gate);
  this.box(this.scene,2.25,.62,.4,.16,1.25,.16,0x54505c);

  // Lamp over the window.
  this.lamp=new T.Mesh(new T.SphereGeometry(.2,14,10),new T.MeshBasicMaterial({color:0xffd489}));
  this.lamp.position.set(0,2.78,.35);this.scene.add(this.lamp);
  const glow=new T.PointLight(0xffc978,22,10);glow.position.set(0,2.6,0);this.scene.add(glow);
  const inner=new T.PointLight(0xffe6c0,26,8);inner.position.set(0,2.1,1.4);this.scene.add(inner);
  const faceLight=new T.PointLight(0xfff1d8,14,5);faceLight.position.set(-.6,1.6,.1);this.scene.add(faceLight);
  this.box(this.scene,0,2.95,.35,.8,.12,.5,0x413b48);

  // Andes at night.
  for(let i=0;i<11;i++){const peak=new T.Mesh(new T.ConeGeometry(3.6+i%3,5.5+i%4,4),new T.MeshStandardMaterial({color:i%2?0x373b52:0x45405a,flatShading:true}));
   peak.position.set(i*5.5-26,1.8,7+i%3*4);this.scene.add(peak)}
  const moon=new T.Mesh(new T.SphereGeometry(1.5,22,14),new T.MeshBasicMaterial({color:0xd7c6a4}));
  moon.position.set(-13,11,10);this.scene.add(moon);

  // Dora at the window, Enzo working behind her. The chinchilla model faces +X and
  // animateChinchilla owns root.rotation.y, so each one sits in a rig group that
  // turns them to face the window (-Z) without being fought by the animation.
  this.doraRig=new T.Group();this.doraRig.position.set(-.35,.78,1.85);this.doraRig.rotation.y=Math.PI/2+.12;
  this.doraRig.scale.setScalar(.82);this.scene.add(this.doraRig);
  this.dora=createChinchilla(true);this.doraRig.add(this.dora.root);
  this.box(this.scene,.15,.73,2.2,3,.12,1.4,0x554a58);                    // shared step behind the counter

  this.enzoRig=new T.Group();this.enzoRig.position.set(1.0,.78,1.9);this.enzoRig.rotation.y=Math.PI/2+.1;
  this.enzoRig.scale.setScalar(.74);this.scene.add(this.enzoRig);
  this.enzo=createChinchilla(false);this.enzoRig.add(this.enzo.root);

  this.scene.add(this.traveler);this.resize();
 }
 permit:T.Mesh;card:T.Mesh;seal:T.Mesh;scaleTop:T.Mesh;denyStamp:T.Group;doraRig:T.Group;enzoRig:T.Group;
 box(root:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:number){
  const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:.85}));
  m.position.set(x,y,z);root.add(m);return m}
 ball(root:T.Object3D,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number){
  const m=new T.Mesh(new T.SphereGeometry(1,18,13),new T.MeshStandardMaterial({color,roughness:.9}));
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);root.add(m);return m}
 // Build a body for whichever species is at the window.
 buildTraveler(species:Species){
  if(this.travelerBody){this.remove(this.travelerBody);this.traveler.remove(this.travelerBody)}
  const g=new T.Group(),color=SPECIES_COLOR[species];
  if(species==='chinchilla'||species==='viscacha'){
   this.ball(g,0,.62,0,.42,.5,.36,color);this.ball(g,.05,1.12,0,.3,.3,.27,color);
   for(const z of [-.17,.17]){const ear=this.ball(g,0,1.5,z,.11,.2,.05,color);ear.rotation.z=z*.6;
    this.ball(g,.24,1.16,z,.05,.06,.04,0x241f2c);this.ball(g,0,.18,z,.17,.1,.1,color)}
   this.ball(g,.3,1.05,0,.1,.08,.09,0xc99184);
   const tail=this.ball(g,-.4,.55,0,.35,.16,.16,color);tail.rotation.z=.5;
  }else if(species==='fox'){
   this.ball(g,0,.6,0,.5,.4,.3,color);this.ball(g,.35,.95,0,.28,.28,.24,0xd9a06a);
   this.ball(g,.62,.9,0,.24,.12,.14,0xe6d4b8);
   for(const z of [-.16,.16]){const ear=new T.Mesh(new T.ConeGeometry(.12,.34,4),new T.MeshStandardMaterial({color:0xa75535}));
    ear.position.set(.26,1.28,z);g.add(ear);this.ball(g,.5,1.02,z,.05,.05,.03,0x181828);this.ball(g,-.2,.16,z,.2,.11,.09,0x553d3c)}
   const tail=this.ball(g,-.6,.5,0,.45,.16,.16,0xdba177);tail.rotation.z=-.4;
  }else if(species==='owl'){
   this.ball(g,0,.65,0,.38,.5,.3,color);this.ball(g,.1,1.15,.04,.34,.3,.27,0xd4c4ad);
   for(const z of [-.19,.19]){this.ball(g,.26,1.18,z,.09,.12,.09,0xe8c869);this.ball(g,.32,1.19,z,.045,.07,.055,0x242038);this.ball(g,0,.14,z,.16,.07,.08,0xcfaa70)}
   this.ball(g,.42,1.03,0,.12,.08,.08,0xc59450);
  }else{
   for(let i=0;i<6;i++)this.ball(g,Math.sin(i)*.2,.14+i*.14,0,.32-i*.02,.16,.24-i*.01,i%2?0x81964e:color);
   this.ball(g,.2,1.02,0,.34,.19,.21,color);
   for(const z of [-.16,.16])this.ball(g,.37,1.06,z,.045,.06,.035,0x382f3a);
  }
  const shadow=new T.Mesh(new T.CircleGeometry(.6,24),new T.MeshBasicMaterial({color:0x121220,transparent:true,opacity:.4,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.02;g.add(shadow);
  this.traveler.add(g);this.travelerBody=g;this.species=species;
 }
 // Called when a new traveler steps up: they walk in from the queue.
 arrive(species:Species){this.buildTraveler(species);this.walk=0;this.verdict='none';this.verdictTime=0;this.exitWalk=0;this.exitLane=0}
 judge(approved:boolean){this.verdict=approved?'approved':'denied';this.verdictTime=0;this.stampTime=.5;if(!approved)this.shake=.35}
 resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;
  this.renderer.setSize(w,h,false);this.camera.aspect=w/h;
  this.camera.position.set(-1.9,2.05,-3.7);this.camera.lookAt(.05,1.2,1.2);this.camera.updateProjectionMatrix()}
 remove(root:T.Object3D){root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.LineSegments){
  o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});this.scene.remove(root)}
 render(g:CheckpointGame,t:number,dt:number){
  const p=g.traveler.papers;
  if(this.species!==p.species)this.arrive(p.species);
  // Walk up to the window, then settle.
  this.walk=Math.min(1,this.walk+dt*.9);
  const ease=1-Math.pow(1-this.walk,3);
  if(this.travelerBody){
   this.travelerBody.position.set(.3,0,-6.2+ease*5.2);this.travelerBody.scale.setScalar(.72);
   // Facing: the body model looks along +X, so -PI/2 turns it toward the booth window.
   // Waiting in line and being inspected they face the inspectors; on a verdict they
   // turn on the spot and walk off, +X through the gate or back down the queue.
   let facing=-Math.PI/2+.18,stepping=this.walk<1;
   if(this.verdict==='approved'){
    // Turn to the gate, wait until the arm is actually clear, then walk through.
    // The exit lane sits at z = EXIT_Z: past the weighing scale (z >= -.98) and
    // under the barrier, so nothing is walked through.
    const turn=Math.min(1,this.verdictTime/.45);
    facing=(-Math.PI/2+.18)*(1-turn);            // 0 rad = walking toward the gate at +X
    const clear=this.gate.rotation.x>1.15;       // barrier is up out of head height
    if(clear)this.exitWalk+=dt*1.6;
    this.exitLane=Math.min(1,this.exitLane+dt*2.2);   // sidestep into the lane before setting off
    this.travelerBody.position.z+=(EXIT_Z-this.travelerBody.position.z)*this.exitLane;
    this.travelerBody.position.x+=Math.min(6,this.exitWalk);
    stepping=clear&&this.exitWalk<6;
   }else if(this.verdict==='denied'){
    const turn=Math.min(1,this.verdictTime/.4);
    facing=(-Math.PI/2+.18)+turn*(Math.PI/2+.18+Math.PI/2); // turn away, back down the line
    const go=Math.max(0,this.verdictTime-.45);
    this.travelerBody.position.z-=Math.min(6,go*2.6);
    stepping=go>0;
   }
   this.travelerBody.rotation.y=facing;
   this.travelerBody.position.y=stepping?Math.abs(Math.sin(t*9))*.09:Math.sin(t*2)*.02;
  }
  if(this.verdict!=='none')this.verdictTime+=dt;
  // Dora leans over the documents; Enzo shuffles paperwork behind her.
  animateChinchilla(this.dora,t,this.verdict==='none'?12:0,true,1,false);
  this.dora.body.rotation.z=-.25+Math.sin(t*1.6)*.05;
  this.dora.feet.forEach((paw,i)=>{if(i%2===1){paw.position.set(.42,.28+Math.sin(t*3+i)*.05,(i<2?-1:1)*.22);paw.rotation.z=-.4}});
  poseChinchillaPaws(this.dora);
  animateChinchilla(this.enzo,t*.8,6,true,1,false);
  this.enzo.body.rotation.z=-.1+Math.sin(t*1.1)*.06;poseChinchillaPaws(this.enzo);
  // The permit reflects the actual papers: no permit means an empty desk, no seal means no gold disc.
  this.permit.visible=p.hasPermit;this.seal.visible=p.hasPermit&&p.sealed;
  const bad=g.verdict&&!g.verdict.correct;
  (this.permit.material as T.MeshStandardMaterial).emissive.set(g.verdict?(g.traveler.flags.length?0x4a1410:0x0d2a12):0x000000);
  (this.card.material as T.MeshStandardMaterial).emissive.set(bad?0x3a1010:0x000000);
  // Stamp slams down on a decision.
  this.stampTime=Math.max(0,this.stampTime-dt);
  const hit=this.stampTime>0?Math.sin((1-this.stampTime/.5)*Math.PI):0;
  const active=this.verdict==='approved'?this.stamp:this.denyStamp;
  this.stamp.position.y=.78;this.denyStamp.position.y=.78;
  if(this.verdict!=='none')active.position.y=.78-hit*.28;
  // The gate arm lifts for an approval.
  const target=this.verdict==='approved'?Math.PI/2.2:0;
  this.gate.rotation.x+=(target-this.gate.rotation.x)*Math.min(1,dt*4);
  // Lamp flicker, red flash and camera shake on a denial.
  const mat=this.lamp.material as T.MeshBasicMaterial;
  mat.color.setHex(this.verdict==='denied'&&this.verdictTime<.6?0xff7b62:0xffd489);
  this.shake=Math.max(0,this.shake-dt);
  this.camera.position.set(-1.9+(this.shake>0?Math.sin(t*70)*.06:0),2.05,-3.7);
  this.camera.lookAt(.05,1.2,1.2);
  this.renderer.render(this.scene,this.camera);
 }
 dispose(){this.scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.LineSegments){
  o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});this.renderer.dispose()}
}
