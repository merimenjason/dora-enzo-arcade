/** Moonlight Mischief: deterministic, DOM-free stealth rules. Coordinates are feet on the painted paths. */
export const WIDTH = 1000, HEIGHT = 640, STEP = .025;
export type Point = { x: number; y: number };
export type Who = 'dora' | 'enzo';
export type Mode = 'night' | 'practice';
export type State = 'playing' | 'won' | 'lost';
export type Hero = Point & { who: Who; face: number; hidden: boolean; dust: number; cooldown: number; dash: number; moving: boolean; home: boolean };
export type Owl = Point & { route: Point[]; stop: number; angle: number; dwell: number; alarm: number; investigate: Point | null; curious: number; heard: number };
export type Input = { x: number; y: number; sneak?: boolean };
export type Event = { t: 'treat' | 'rescue' | 'dust' | 'hide' | 'dash' | 'distract' | 'push' | 'gap' | 'alert' | 'caught' | 'home' | 'won' | 'lost'; x: number; y: number };
type Road = [number, number, number, number, number];
export const ROADS: Road[] = [
  [160,425,225,465,32], [225,465,350,535,34], [350,535,460,560,38], [460,560,560,510,42], [560,510,700,480,40], [700,480,845,490,37], [845,490,905,600,38],
  [845,490,845,405,36], [845,405,735,370,42], [735,370,620,340,34], [620,340,505,300,34], [505,300,395,285,35], [395,285,305,235,28], [305,235,205,190,30],
  [735,370,795,300,40], [795,300,905,285,46], [905,285,835,215,48], [835,215,790,150,37], [790,150,850,105,30],
  [505,300,515,245,26], [515,245,560,215,28], [700,480,650,410,32], [650,410,620,340,30],
];
export const HOME: Point = { x: 205, y: 190 };
export const CAGE: Point = { x: 515, y: 245 };
export const BOWL: Point = { x: 540, y: 515 };
export const CRATE: Point = { x: 650, y: 412 };
export const GAP = [{ x: 190, y: 410 }, { x: 395, y: 285 }];
export const HIDES: Point[] = [{ x: 220, y: 465 }, { x: 460, y: 550 }, { x: 790, y: 300 }, { x: 300, y: 235 }];
export const NOISY = [{x:875,y:275,r:75},{x:735,y:370,r:55}];
export const OCCLUDERS = [[0,0,180,170], [320,0,310,205], [0,290,175,75], [250,350,235,75], [635,0,110,280], [940,0,60,230]];
const P = (x: number, y: number): Point => ({ x, y });
export const NIGHTS = [
  { name: 'Lantern Lane', seconds: 180, text: 'A first little heist. Learn the paths, recover five bundles and bring everyone home.', treats: [P(245,215),P(480,300),P(740,375),P(875,275),P(840,490)], owls: [[P(790,150),P(835,215),P(905,285),P(795,300)],[P(735,370),P(620,340),P(650,410),P(700,480)]] },
  { name: 'The Watchful Warren', seconds: 165, text: 'A third owl watches the lower path. Dust and distractions make space to slip past.', treats: [P(245,215),P(560,215),P(740,375),P(850,105),P(840,490),P(350,535)], owls: [[P(790,150),P(835,215),P(905,285),P(795,300)],[P(735,370),P(620,340),P(650,410),P(700,480)],[P(460,560),P(560,510),P(700,480)]] },
  { name: 'One Last Moonbeam', seconds: 150, text: 'Seven bundles, quicker patrols and a short night. A quiet dash can save the last seconds.', treats: [P(245,215),P(560,215),P(740,375),P(850,105),P(905,285),P(840,490),P(350,535)], owls: [[P(790,150),P(835,215),P(905,285),P(795,300)],[P(735,370),P(620,340),P(650,410),P(700,480)],[P(460,560),P(560,510),P(700,480)]] },
];
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const segmentDistance = (p: Point, a: Point, b: Point) => { const d = (b.x-a.x)**2+(b.y-a.y)**2, t = clamp(((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/d,0,1); return dist(p,P(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)); };
const finitePoint = (p: unknown): boolean => !!p && typeof p === 'object' && Number.isFinite((p as Point).x) && Number.isFinite((p as Point).y) && (p as Point).x >= 0 && (p as Point).x <= WIDTH && (p as Point).y >= 0 && (p as Point).y <= HEIGHT;
export class Game {
  night: number; mode: Mode; state: State = 'playing'; paused = false; started = false; time = 0; active: Who = 'dora'; catches = 0; rescued = false; pushed = false;
  heroes: Hero[]; owls: Owl[]; treats: (Point & { taken: boolean })[]; friend: Point | null = null; friendHome = false;
  target: Point | null = null; trail: Point[] = []; events: Event[] = []; note = 'Move on the paths. Q switches friends; E interacts.'; noteTime = 5;
  private friendTrail: Point[] = [];
  private warned = new Set<Owl>();
  constructor(night = 0, mode: Mode = 'night') {
    this.night = clamp(Math.floor(night),0,2); this.mode = mode;
    this.heroes = [P(160,425),P(205,455)].map((p,i)=>({...p,who:i?'enzo':'dora',face:1,hidden:false,dust:0,cooldown:0,dash:0,moving:false,home:false}));
    this.treats = NIGHTS[this.night].treats.map(p=>({...p,taken:false}));
    this.owls = NIGHTS[this.night].owls.map((route,i)=>({...route[0],route:route.map(p=>({...p})),stop:1,angle:Math.atan2(route[1].y-route[0].y,route[1].x-route[0].x),dwell:i*.7,alarm:0,investigate:null,curious:0,heard:0}));
  }
  get hero() { return this.heroes.find(h=>h.who===this.active)!; }
  get collected() { return this.treats.filter(t=>t.taken).length; }
  get left() { return Math.max(0,NIGHTS[this.night].seconds-this.time); }
  get stars() { return this.state==='won'&&this.mode==='night' ? 1+Number(this.catches===0)+Number(this.time<NIGHTS[this.night].seconds*.75) : 0; }
  attention(h:Hero) {return h.hidden||h.home?0:Math.max(0,...this.owls.filter(o=>this.visible(o,h)).map(o=>o.alarm));}
  get objective() {
    if(!this.started)return 'Tap a lit path or use the arrows to begin. The clock waits for you.';
    if(this.collected<this.treats.length)return `Recover ${this.treats.length-this.collected} more treat ${this.treats.length-this.collected===1?'bundle':'bundles'}. Watch the gold vision cones.`;
    if(!this.rescued)return 'Switch to Enzo and open the rescue cage.';
    if(this.hero.home)return `Switch to ${this.active==='dora'?'Enzo':'Dora'} and bring your other friend home.`;
    return 'Bring both chinchillas to the HOME door and choose Get home.';
  }
  say(note: string) { this.note=note; this.noteTime=4; }
  private event(t: Event['t'],p: Point=this.hero) { this.events.push({t,x:p.x,y:p.y}); }
  pause(on: boolean) { if(this.state!=='playing')return;this.paused=on; this.clearMove(); this.heroes.forEach(h=>{h.moving=false;h.dash=0;}); }
  clearMove() { this.trail=[]; this.target=null; }
  switch() { if(this.state!=='playing')return; this.active=this.active==='dora'?'enzo':'dora';this.clearMove();this.say(this.active==='dora'?'Dora: quiet dash and narrow fence gaps.':'Enzo: distractions, heavy obstacles and the rescue latch.'); }
  walkable(p: Point, crate = true) {
    if(!finitePoint(p))return false;
    if(crate&&!this.pushed&&Math.abs(p.x-CRATE.x)<22&&Math.abs(p.y-CRATE.y)<18)return false;
    return ROADS.some(([x,y,a,b,w])=>segmentDistance(p,P(x,y),P(a,b))<=w);
  }
  private clearSegment(a:Point,b:Point) {const n=Math.max(1,Math.ceil(dist(a,b)/3));for(let i=0;i<=n;i++)if(!this.walkable(P(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n)))return false;return true;}
  /** Shared visibility rays let the scene show the same occluded cone used by the rules. */
  ray(o: Point,angle: number,range=165) {
    for(let d=4;d<=range;d+=4) { const p=P(o.x+Math.cos(angle)*d,o.y+Math.sin(angle)*d);if(!finitePoint(p)||OCCLUDERS.some(([x,y,w,h])=>p.x>x&&p.x<x+w&&p.y>y&&p.y<y+h))return P(o.x+Math.cos(angle)*(d-4),o.y+Math.sin(angle)*(d-4)); }
    return P(o.x+Math.cos(angle)*range,o.y+Math.sin(angle)*range);
  }
  visible(o: Owl,p: Point) {
    const d=dist(o,p); if(d>165)return false;const a=Math.atan2(p.y-o.y,p.x-o.x),delta=Math.atan2(Math.sin(a-o.angle),Math.cos(a-o.angle));
    return Math.abs(delta)<.48 && dist(o,this.ray(o,a,Math.min(165,d+4)))>=d-2;
  }
  /** A* over 20-unit path cells. It refuses blocked ground and cutting corners. */
  path(from: Point,to: Point,safe=false): Point[] {
    const cells: Point[]=[];for(let y=10;y<HEIGHT;y+=20)for(let x=10;x<WIDTH;x+=20)if(this.walkable(P(x,y)))cells.push(P(x,y));
    const near=(p:Point)=>cells.reduce((a,b)=>dist(p,a)<dist(p,b)?a:b),a=cells.filter(p=>dist(p,from)<45&&this.clearSegment(from,p)).sort((a,b)=>dist(a,from)-dist(b,from))[0]??near(from),b=near(to),key=(p:Point)=>`${p.x}:${p.y}`;
    if(dist(b,to)>55)return [];
    const by=new Map(cells.map(p=>[key(p),p])),open=[a],cost=new Map([[key(a),0]]),parents=new Map<string,string>(),closed=new Set<string>();
    while(open.length) {
      open.sort((p,q)=>cost.get(key(p))!+dist(p,b)-cost.get(key(q))!-dist(q,b));const p=open.shift()!,k=key(p);if(closed.has(k))continue;closed.add(k);
      if(k===key(b)) { const route=[b];let cur=k;while(parents.has(cur)){cur=parents.get(cur)!;route.push(by.get(cur)!);}route.reverse();if(this.clearSegment(b,to))route.push({...to});return route; }
      for(const [dx,dy] of [[20,0],[-20,0],[0,20],[0,-20],[20,20],[20,-20],[-20,20],[-20,-20]]) {
        const q=by.get(`${p.x+dx}:${p.y+dy}`);if(!q||closed.has(key(q))||!this.clearSegment(p,q))continue;
        if(dx&&dy&&(!this.walkable(P(p.x+dx,p.y))||!this.walkable(P(p.x,p.y+dy))))continue;
        const n=cost.get(k)!+Math.hypot(dx,dy)*(safe&&this.owls.some(o=>this.visible(o,q))?8:1);if(n>=(cost.get(key(q))??Infinity))continue;
        cost.set(key(q),n);parents.set(key(q),k);open.push(q);
      }
    }return [];
  }
  go(p: Point) { if(this.paused||this.state!=='playing'||this.hero.home)return; if(!finitePoint(p)){this.say('Choose a spot on the lit paths.');return;}const route=this.path(this.hero,p);if(!route.length){this.say('Choose a spot on the lit paths.');return;}this.hero.hidden=false;this.trail=route;this.target={...route.at(-1)!};this.started=true; }
  context(): { label: string; type: string; allowed: boolean } {
    const h=this.hero;
    if(h.home)return {label:'Safely home',type:'home',allowed:false};
    if(h.hidden)return {label:'Leave hiding',type:'hide',allowed:true};
    if(dist(h,HOME)<58)return {label:this.collected===this.treats.length&&this.rescued?'Get home':'Recover every treat and rescue your friend first',type:'home',allowed:this.collected===this.treats.length&&this.rescued};
    if(!this.rescued&&dist(h,CAGE)<62)return {label:h.who==='enzo'?'Open rescue cage':'Enzo can open this latch',type:'rescue',allowed:h.who==='enzo'};
    if(!this.pushed&&dist(h,CRATE)<58)return {label:h.who==='enzo'?'Push obstacle':'Enzo can push this obstacle',type:'push',allowed:h.who==='enzo'};
    if(GAP.some(p=>dist(h,p)<40))return {label:h.who==='dora'?'Squeeze through fence':'Only Dora fits this gap',type:'gap',allowed:h.who==='dora'};
    if(dist(h,BOWL)<52)return {label:'Roll in dry dust',type:'dust',allowed:true};
    if(h.hidden||HIDES.some(p=>dist(h,p)<48))return {label:h.hidden?'Leave hiding':'Hide in hay',type:'hide',allowed:true};
    return {label:'Move near hay, dust or a marked object',type:'none',allowed:false};
  }
  interact() {
    if(this.paused||this.state!=='playing')return false;const h=this.hero,c=this.context();if(!c.allowed){this.say(c.label);return false;}this.clearMove();h.moving=false;h.dash=0;this.started=true;
    if(c.type==='home') {h.home=true;h.hidden=false;this.event('home');this.say('Safely home! Switch to bring the other friend back.');if(this.heroes.every(p=>p.home)&&this.friendHome)this.finish(true);}
    if(c.type==='rescue') {this.rescued=true;this.friend={...CAGE};this.friendTrail=this.path(CAGE,HOME);this.event('rescue',CAGE);this.say('Your friend is free and heading home. Bring both chinchillas back.');}
    if(c.type==='push') {this.pushed=true;this.event('push',CRATE);this.say('A new shortcut is open.');}
    if(c.type==='gap') {const end=dist(h,GAP[0])<dist(h,GAP[1])?GAP[1]:GAP[0];h.x=end.x;h.y=end.y;h.hidden=false;this.event('gap');this.say('Dora slips through the fence.');}
    if(c.type==='dust') {h.dust=22;this.event('dust');this.say('Dry dust masks your scent for 22 seconds. Owls can still spot you close up.');}
    if(c.type==='hide') {h.hidden=!h.hidden;this.event('hide');this.say(h.hidden?'Hidden. Wait for the patrol to pass.':'Back on the path.');}
    return true;
  }
  ability() {
    if(this.paused||this.state!=='playing'||this.hero.home||this.hero.cooldown>0)return false;const h=this.hero;h.hidden=false;this.started=true;
    if(h.who==='dora'){h.dash=.32;h.cooldown=4;this.event('dash');this.say('Quiet dash! Move to steer.');}
    else {h.cooldown=8;const at=P(h.x+h.face*80,h.y);for(const o of this.owls)if(dist(o,h)<280){o.investigate=at;o.curious=4.5;o.alarm=0;}this.event('distract',at);this.say('Enzo makes a decoy rustle. Nearby owls look toward it.');}
    return true;
  }
  private finish(won: boolean) {this.state=won?'won':'lost';this.paused=false;this.clearMove();this.heroes.forEach(h=>h.moving=false);this.event(won?'won':'lost');}
  private step(dt:number,input:Input) {
    this.time+=dt;this.noteTime=Math.max(0,this.noteTime-dt);
    for(const h of this.heroes){h.cooldown=Math.max(0,h.cooldown-dt);h.dust=Math.max(0,h.dust-dt);h.dash=Math.max(0,h.dash-dt);h.moving=false;}
    const h=this.hero;let dx=input.x,dy=input.y;
    if((dx||dy)&&!h.home){this.clearMove();h.hidden=false;}
    else if(this.trail.length&&!h.home&&!h.hidden){const p=this.trail[0];if(dist(h,p)<1)this.trail.shift();else {dx=p.x-h.x;dy=p.y-h.y;}}
    else if(h.dash>0&&!h.home&&!h.hidden)dx=h.face;
    const len=Math.hypot(dx,dy),speed=h.dash>0?290:input.sneak?55:95;
    if(len&&!h.home&&!h.hidden){const distance=this.trail.length&&!input.x&&!input.y?Math.min(len,speed*dt):speed*dt;dx=dx/len*distance;dy=dy/len*distance;const next=P(h.x+dx,h.y+dy);if(this.walkable(next)){h.x=next.x;h.y=next.y;}else{if(this.walkable(P(h.x+dx,h.y)))h.x+=dx;if(this.walkable(P(h.x,h.y+dy)))h.y+=dy;}h.face=dx<0?-1:dx>0?1:h.face;h.moving=true;}
    if(!this.trail.length)this.target=null;
    for(const t of this.treats)for(const p of this.heroes)if(!t.taken&&!p.home&&!p.hidden&&dist(t,p)<27){t.taken=true;this.event('treat',t);this.say(`${this.collected} / ${this.treats.length} treats recovered.`);}
    for(const o of this.owls) {
      if(o.alarm<.08)this.warned.delete(o);
      o.heard=Math.max(0,o.heard-dt);o.curious=Math.max(0,o.curious-dt);o.dwell=Math.max(0,o.dwell-dt);
      if(!o.curious)o.investigate=null;
      if(h.moving&&!input.sneak&&!h.dash&&!h.dust&&!o.curious&&!o.heard&&dist(o,h)<200&&NOISY.some(p=>dist(p,h)<p.r)){o.investigate=P(h.x,h.y);o.curious=1.4;o.heard=2.5;}
      const goal=o.investigate??o.route[o.stop],d=dist(o,goal);
      if(d>3&&!o.dwell){o.angle=Math.atan2(goal.y-o.y,goal.x-o.x);if(!o.investigate){const speed=22+this.night*5;o.x+=Math.cos(o.angle)*Math.min(d,speed*dt);o.y+=Math.sin(o.angle)*Math.min(d,speed*dt);}}
      else if(!o.investigate&&!o.dwell){o.stop=(o.stop+1)%o.route.length;o.dwell=1.2;}
      const visible=this.heroes.filter(p=>!p.hidden&&!p.home&&this.visible(o,p));
      if(visible.length){const p=visible.sort((a,b)=>dist(o,a)-dist(o,b))[0];o.alarm=Math.min(1,o.alarm+dt*(p.dust>0&&dist(o,p)>65?.12:input.sneak&&p===h?.36:.48));if(!this.warned.has(o)&&o.alarm>=.28){this.warned.add(o);this.event('alert',p);this.say(`${p.who==='dora'?'Dora':'Enzo'} is being watched! Leave the cone or hide in hay.`);}if(o.alarm>=1){this.catches++;p.x=p.who==='dora'?160:205;p.y=p.who==='dora'?425:455;p.dust=0;p.dash=0;p.hidden=false;if(p===h)this.clearMove();this.owls.forEach(g=>{g.alarm=0;g.curious=1.8;g.investigate=P(p.x,p.y);});this.warned.clear();this.event('caught',p);this.say(this.mode==='practice'?'Spotted! Back to the safe path; keep practising.':`Spotted! ${Math.max(0,3-this.catches)} chances left.`);if(this.mode==='night'&&this.catches>=3){this.finish(false);break;}}}
      else o.alarm=Math.max(0,o.alarm-dt*.65);
    }
    if(this.friend&&!this.friendHome){while(this.friendTrail.length&&dist(this.friend,this.friendTrail[0])<8)this.friendTrail.shift();const p=this.friendTrail[0]??HOME,d=dist(this.friend,p);if(d){this.friend.x+=(p.x-this.friend.x)/d*Math.min(d,115*dt);this.friend.y+=(p.y-this.friend.y)/d*Math.min(d,115*dt);}if(dist(this.friend,HOME)<30){this.friendHome=true;this.friend={...HOME};}}
    if(this.heroes.every(p=>p.home)&&this.friendHome)this.finish(true);
    if(this.mode==='night'&&this.time>=NIGHTS[this.night].seconds&&this.state==='playing'){this.say('Dawn has arrived. Try a quieter route.');this.finish(false);}
  }
  update(dt:number,input:Input={x:0,y:0}) {
    if(this.paused||this.state!=='playing'||!Number.isFinite(dt)||dt<0)return;
    const valid={x:Number.isFinite(input.x)?clamp(input.x,-1,1):0,y:Number.isFinite(input.y)?clamp(input.y,-1,1):0,sneak:!!input.sneak};
    if(valid.x||valid.y)this.started=true;if(!this.started)return;
    let left=Math.min(dt,2);while(left>0&&this.state==='playing'){const d=Math.min(STEP,left);this.step(d,valid);left-=d;}
  }
  save() {return JSON.stringify({v:1,night:this.night,mode:this.mode,state:this.state,started:this.started,time:this.time,active:this.active,catches:this.catches,rescued:this.rescued,pushed:this.pushed,heroes:this.heroes,owls:this.owls,treats:this.treats,friend:this.friend,friendHome:this.friendHome});}
  static load(text:string):Game|null {
    try {const s=JSON.parse(text);if(s.v!==1||!Number.isInteger(s.night)||s.night<0||s.night>2||!['night','practice'].includes(s.mode)||s.state!=='playing'||!['dora','enzo'].includes(s.active)||!Number.isFinite(s.time)||s.time<0||s.time>86400||!Number.isInteger(s.catches)||s.catches<0||s.catches>10000)return null;
      const g=new Game(s.night,s.mode);for(const k of ['started','rescued','pushed','friendHome'])if(typeof s[k]!=='boolean')return null;
      if(!Array.isArray(s.heroes)||s.heroes.length!==2||!Array.isArray(s.owls)||s.owls.length!==g.owls.length||!Array.isArray(s.treats)||s.treats.length!==g.treats.length)return null;
      if(s.mode==='night'&&(s.catches>=3||s.time>=NIGHTS[s.night].seconds))return null;g.pushed=s.pushed;
      for(let i=0;i<2;i++){const h=s.heroes[i];if(!finitePoint(h)||h.who!==g.heroes[i].who||!g.walkable(h)||![1,-1].includes(h.face)||['hidden','moving','home'].some(k=>typeof h[k]!=='boolean')||Object.entries({dust:22,cooldown:i?8:4,dash:.32}).some(([k,max])=>!Number.isFinite(h[k])||h[k]<0||h[k]>max)||h.home&&dist(h,HOME)>=58||h.hidden&&!HIDES.some(p=>dist(p,h)<48))return null;g.heroes[i]={...h,moving:false,dash:0};}
      for(let i=0;i<g.owls.length;i++){const o=s.owls[i],route=g.owls[i].route;if(!finitePoint(o)||!Number.isInteger(o.stop)||o.stop<0||o.stop>=route.length||!route.some((p,j)=>segmentDistance(o,p,route[(j+1)%route.length])<=3.05)||!Number.isFinite(o.angle)||Math.abs(o.angle)>Math.PI||Object.entries({dwell:1.4,alarm:1,curious:4.5,heard:2.5}).some(([k,max])=>!Number.isFinite(o[k])||o[k]<0||o[k]>max)||o.investigate!==null&&!finitePoint(o.investigate))return null;g.owls[i]={...o,route};}
      for(let i=0;i<g.treats.length;i++){const t=s.treats[i];if(!finitePoint(t)||dist(t,g.treats[i])>.01||typeof t.taken!=='boolean')return null;g.treats[i].taken=t.taken;}
      if(s.friend!==null&&(!finitePoint(s.friend)||!g.walkable(s.friend,false))||s.rescued!==!!s.friend||s.friendHome&&(!s.rescued||dist(s.friend,HOME)>=30)||s.heroes.some((h:Hero)=>h.home)&&(!s.rescued||s.treats.some((t:{taken:boolean})=>!t.taken)))return null;
      g.started=s.started;g.time=s.time;g.active=s.active;g.catches=s.catches;g.rescued=s.rescued;g.friend=s.friend;g.friendHome=s.friendHome;if(g.friend&&!g.friendHome)g.friendTrail=g.path(g.friend,HOME);g.paused=true;g.say('Route restored. Carry on when ready.');return g;
    }catch{return null;}
  }
}
