export type FighterId='dora'|'enzo'|'fox'|'owl'|'snake'|'agent'|'trump';
export const ROSTER: {id:FighterId;name:string;tag:string;special:string;color:string;speed:number;power:number}[]=[
{id:'dora',name:'DORA',tag:'The white whirlwind',special:'Dust Blossom',color:'#e6c7df',speed:4.8,power:1},
{id:'enzo',name:'ENZO',tag:'The grey bruiser',special:'Thunder Chew',color:'#78bbd0',speed:4,power:1.14},
{id:'fox',name:'ANDEAN FOX',tag:'The canyon hunter',special:'Ember Pounce',color:'#ec9d57',speed:4.7,power:1.03},
{id:'owl',name:'NIGHT OWL',tag:'Silent wings, loud hits',special:'Feather Cyclone',color:'#c1aedf',speed:4.2,power:1.1},
{id:'snake',name:'VIPER',tag:'The coiled challenger',special:'Venom Wave',color:'#aed278',speed:3.8,power:1.08},
{id:'agent',name:'ICE AGENT',tag:'The checkpoint brawler',special:'Red Tape',color:'#78b1b5',speed:3.7,power:1.15},
{id:'trump',name:'DONALD TRUMP',tag:'The podium powerhouse',special:'Golden Tweet',color:'#f2c960',speed:3.5,power:1.14},
];
export const SPECIALS:Record<FighterId,{speed:number;damage:number;radius:number;description:string}>={
 dora:{speed:6,damage:17,radius:.55,description:'A broad, slow dust fireball.'},enzo:{speed:8,damage:20,radius:.34,description:'A fast, heavy electric chew bolt.'},fox:{speed:10,damage:16,radius:.3,description:'A quick ember fireball.'},owl:{speed:7,damage:7,radius:.23,description:'Three feathers fan out at different heights.'},snake:{speed:6.8,damage:14,radius:.3,description:'A low venom wave that can be jumped.'},agent:{speed:7.5,damage:12,radius:.4,description:'A red-tape blast that briefly slows its target.'},trump:{speed:4.8,damage:24,radius:.6,description:'A large, slow golden energy wave.'}};
export const RISERS:Record<FighterId,{name:string;damage:number;lift:number;description:string}>={
 dora:{name:'Dust Spiral',damage:17,lift:9.4,description:'A spinning rising paw that swats jumpers.'},enzo:{name:'Static Uppaw',damage:18,lift:8.8,description:'A crackling uppercut with heavy launch.'},fox:{name:'Canyon Leap',damage:16,lift:9.8,description:'A soaring claw pounce that climbs high.'},owl:{name:'Updraft',damage:14,lift:10.2,description:'A wing beat that lifts the owl above fireballs.'},snake:{name:'Coil Strike',damage:17,lift:8.4,description:'A short coil launch with a biting apex.'},agent:{name:'Baton Rise',damage:16,lift:8.6,description:'A rising baton swing that stops air rushes.'},trump:{name:'Podium Slam',damage:19,lift:8.2,description:'A slow but brutal rising haymaker.'}};
export const SUPERS:Record<FighterId,{name:string;damage:number;hits:number;speed:number;radius:number;description:string}>={
 dora:{name:'Andean Bloom',damage:11,hits:4,speed:7.5,radius:.5,description:'Four dust blossoms bloom across the arena.'},enzo:{name:'Thunder Chorus',damage:13,hits:4,speed:9,radius:.36,description:'A rolling barrage of thunder bolts.'},fox:{name:'Ember Hunt',damage:10,hits:5,speed:11,radius:.3,description:'Five ember darts in a blistering rush.'},owl:{name:'Moonlit Gale',damage:9,hits:6,speed:8,radius:.26,description:'A storm of feathers at every height.'},snake:{name:'Venom Flood',damage:12,hits:4,speed:7.4,radius:.34,description:'Overlapping low venom waves.'},agent:{name:'Full Audit',damage:11,hits:4,speed:8,radius:.42,description:'Stacked red tape that keeps the target slowed.'},trump:{name:'Gold Rush',damage:15,hits:3,speed:5.4,radius:.62,description:'Three huge golden waves that crowd the screen.'}};
export type StoryBeat={chapter:number;place:string;title:string;text:string};
export const STORY:Record<FighterId,{place:string;before:string;after:string}>={
 dora:{place:'THE BURROW, CHILE',before:'Dora has read the citizenship handbook twice and thinks the whole plan is nonsense. Convince her the hard way.',after:'Dora stuffs the handbook into your bag. "Fine. But I am coming with you."'},
 enzo:{place:'ANTOFAGASTA DOCKS',before:'Enzo runs the cargo crates north. Passage costs one honest bout.',after:'Enzo waves you aboard a crate marked ALPACA WOOL. Next stop: north.'},
 fox:{place:'ATACAMA CROSSING',before:'An Andean fox has claimed the only path out of the desert, and he charges a toll in fur.',after:'The fox lets you pass and points at the highway lights. Paperwork is still ahead.'},
 snake:{place:'DARIEN GAP',before:'A viper owns the jungle route where the road ends. She does not accept documents.',after:'The viper slides aside. The jungle opens onto a long road north.'},
 owl:{place:'RIO GRANDE, MIDNIGHT',before:'A night owl watches the river and decides who crosses quietly and who does not.',after:'The owl drops a feather in the water. Cross now, little one, while it is dark.'},
 agent:{place:'THE ICE CHECKPOINT',before:'An ICE agent wants papers a chinchilla has never been allowed to hold. This one will not be talked down.',after:'The detention file blows off the desk. Someone stamps your form by accident. You keep walking.'},
 trump:{place:'THE NATURALIZATION PODIUM',before:'The final hearing. The man behind the gold microphone says your kind does not belong here. The oath is on the table behind him.',after:'The podium cracks. You take the oath yourself, in a small squeaky voice, and nobody stops you.'}};
export const STORY_ORDER:FighterId[]=['dora','enzo','fox','snake','owl','agent','trump'];
export const STORY_INTRO='A chinchilla leaves the Andes with a folded application, a dream of citizenship, and absolutely no lawyer. Seven fights stand between the burrow and the oath.';
export const STORY_END='The certificate is stamped, the fur is filthy, and the trophy says CITIZEN. Somewhere south, an old burrow gets a very long letter.';
export type Input={move:number;down?:boolean;jump?:boolean;block?:boolean;jab?:boolean;kick?:boolean;special?:boolean;rising?:boolean;super?:boolean;throw?:boolean};
export type Attack='jab'|'kick'|'special'|'rising'|'super'|'throw';
export type Mode='arcade'|'story'|'training'|'versus'|'survival'|'timeattack';
export type Difficulty='easy'|'normal'|'hard';
export type Dummy='stand'|'block'|'jump'|'fight';
export type StageId='market'|'burrow'|'docks'|'atacama'|'darien'|'river'|'checkpoint'|'podium';
export type Body={id:FighterId;x:number;y:number;vy:number;hp:number;meter:number;facing:number;block:boolean;stun:number;cooldown:number;attack:Attack|null;attackTime:number;hit:boolean;flash:number;combo:number;comboTime:number;slow:number;rising:number;
 /** blockstun, guard meter (breaks at 0), time since the last blocked hit, whether the current attack connected (so it can cancel), and throw state */
 bstun:number;guard:number;guardRest:number;landed:boolean;attackId:number;grab:number;grabbed:number;tech:number};
export type Shot={x:number;y:number;dir:number;owner:0|1;life:number;kind:FighterId;speed:number;damage:number;radius:number;vy:number;delay:number;move:'special'|'super';attackId:number};
/** Something the page shows or plays: sparks, a shake, a sound. */
export type FightEvent={kind:'hit'|'block'|'throw'|'break'|'guardbreak'|'clash'|'whiff'|'trial'|'ko';owner:0|1;move?:Attack;x:number;y:number;combo?:number;damage?:number};
const empty:Input={move:0};
const body=(id:FighterId,x:number,facing:number,hp=100):Body=>({id,x,y:0,vy:0,hp,meter:50,facing,block:false,stun:0,cooldown:0,attack:null,attackTime:0,hit:false,flash:0,combo:0,comboTime:0,slow:0,rising:0,bstun:0,guard:100,guardRest:0,landed:false,attackId:0,grab:0,grabbed:0,tech:0});
export const SPECIAL_COST=35,RISING_COST=20,SUPER_COST=100;
/** How each kind of hit feels: hitstun, blockstun, hit-stop freeze and screen shake (seconds). */
export const HIT:Record<Attack,{stun:number;block:number;stop:number;shake:number}>={jab:{stun:.22,block:.12,stop:.05,shake:.04},kick:{stun:.32,block:.18,stop:.07,shake:.07},special:{stun:.36,block:.2,stop:.06,shake:.06},rising:{stun:.5,block:.22,stop:.09,shake:.12},super:{stun:.32,block:.2,stop:.05,shake:.09},throw:{stun:.8,block:0,stop:.1,shake:.15}};
/** Which attacks can cut short the one before it, once it has connected (hit or blocked). */
export const CANCELS:Partial<Record<Attack,Attack[]>>={jab:['kick','special','rising','super'],kick:['special','rising','super']};
export const THROW_DAMAGE=12,THROW_RANGE=1.6,GUARD_MAX=100,CHIP=.15;
/** The CPU at each level: how often it decides, and its chance to guard, anti-air, deal with fireballs, punish, break throws, throw and cancel. */
export const DIFFICULTY:Record<Difficulty,{tick:[number,number];guard:number;antiAir:number;dodge:number;punish:number;tech:number;throw:number;cancel:number;zone:number}>={
 easy:{tick:[.5,.9],guard:.25,antiAir:.15,dodge:.25,punish:.1,tech:.05,throw:.03,cancel:0,zone:.3},
 normal:{tick:[.28,.55],guard:.55,antiAir:.5,dodge:.55,punish:.45,tech:.25,throw:.12,cancel:.35,zone:.45},
 hard:{tick:[.14,.3],guard:.8,antiAir:.85,dodge:.85,punish:.85,tech:.6,throw:.25,cancel:.85,zone:.55}};
/** Each fighter's home arena: the story chapter fought there. The night market is the eighth. */
export const HOME:Record<FighterId,StageId>={dora:'burrow',enzo:'docks',fox:'atacama',snake:'darien',owl:'river',agent:'checkpoint',trump:'podium'};
export const STAGES:Record<StageId,string>={market:'ANDEAN NIGHT MARKET',burrow:'THE BURROW, CHILE',docks:'ANTOFAGASTA DOCKS',atacama:'ATACAMA CROSSING',darien:'DARIEN GAP',river:'RIO GRANDE, MIDNIGHT',checkpoint:'THE ICE CHECKPOINT',podium:'THE NATURALIZATION PODIUM'};
export const STAGE_ORDER:StageId[]=['market','burrow','docks','atacama','darien','river','checkpoint','podium'];
/** Combo trials, the same five routes for everyone, named with each fighter's own moves. */
export const TRIALS:{name:string;moves:Attack[]}[]=[{name:'Jab into kick',moves:['jab','kick']},{name:'Special finish',moves:['jab','kick','special']},{name:'Launcher',moves:['jab','kick','rising']},{name:'Super finish',moves:['jab','kick','super']},{name:'Throw follow-up',moves:['throw','special']}];
export const moveName=(id:FighterId,a:Attack)=>a==='special'?ROSTER.find(r=>r.id===id)!.special:a==='rising'?RISERS[id].name:a==='super'?SUPERS[id].name:a==='throw'?'Throw':a==='jab'?'Jab':'Kick';
type Motion={stage:number;time:number;rise:number;riseTime:number;buf:Partial<Record<Attack,number>>;prev:Input;lastJab:number;lastKick:number};
const motion=():Motion=>({stage:0,time:0,rise:0,riseTime:0,buf:{},prev:{move:0},lastJab:-9,lastKick:-9});
type Brain={clock:number;guard:boolean;antiAir:boolean;dodge:boolean;punish:boolean;tech:boolean;combo:boolean;jumpIn:boolean;grab:number};
const brain=():Brain=>({clock:.6,guard:false,antiAir:false,dodge:false,punish:false,tech:false,combo:false,jumpIn:false,grab:0});
const clamp=(x:number)=>Math.max(-6.8,Math.min(6.8,x));
export class FighterGame{
 notice='';noticeTime=0;mode:Mode='arcade';beat:StoryBeat|null=null;dummy:Dummy='stand';training={damage:0,best:0,hits:0,bestCombo:0};
 state:'select'|'story'|'fight'|'paused'|'round'|'match'|'champion'|'result'='select';selected:FighterId='dora';opponent=0;round=1;wins=[0,0];time=60;fighters:[Body,Body]=[body('dora',-3,1),body('fox',3,-1)];shots:Shot[]=[];message='CHOOSE YOUR FIGHTER';ai=true;seed=17;intro=1.2;result:0|1|2=2;impact=0;
 /** CPU level for the rival, and for the player's side when a CPU plays both (the bot). */
 difficulty:Difficulty='normal';demo:Difficulty|null=null;
 /** hit-stop freeze, shake strength, fight clock (time attack), survival streak, versus pick and arena, alternate colours */
 hitstop=0;shake=0;clock=0;streak=0;p2:FighterId='enzo';versusStage:StageId='market';alt:[boolean,boolean]=[false,false];
 events:FightEvent[]=[];trial=-1;trialStep=0;trialDone=false;
 motions:[Motion,Motion]=[motion(),motion()];brains:[Brain,Brain]=[brain(),brain()];t=0;nextAttack=1;trialLast=0;
 get rivals(){return (this.mode==='story'?STORY_ORDER:ROSTER.map(r=>r.id)).filter(id=>id!==this.selected)}
 get active(){return this.state==='fight'}
 get rival():FighterId{return this.mode==='versus'?this.p2:this.rivals[Math.min(this.opponent,this.rivals.length-1)]}
 get stage():StageId{return this.mode==='versus'?this.versusStage:this.mode==='training'?'market':HOME[this.rival]}
 /** Rounds to take a match: survival is one round per rival. */
 get need(){return this.mode==='survival'?1:2}
 pick(id:FighterId){this.state='select';this.selected=id;this.opponent=0;this.round=1;this.wins=[0,0];this.time=60;this.shots=[];this.notice='';this.noticeTime=0;this.beat=null;this.streak=0;this.clock=0;this.fighters=[body(id,-3,1),body(this.rivals[0],3,-1)]}
 start(mode:Mode='arcade'){this.mode=mode;this.opponent=0;this.round=1;this.wins=[0,0];this.streak=0;this.clock=0;this.training={damage:0,best:0,hits:0,bestCombo:0};if(mode==='story'){this.showBeat('before')}else{this.beat=null;this.resetRound()}}
 startStory(){this.start('story')}
 startTraining(rival?:FighterId){this.mode='training';this.opponent=rival?this.rivals.indexOf(rival):0;this.start('training')}
 /** Two players on one machine: player two's fighter and the arena. */
 startVersus(p2:FighterId,stage:StageId=this.versusStage){this.p2=p2;this.versusStage=stage;this.start('versus')}
 setDummy(d:Dummy){this.dummy=d}
 setTrial(n:number){this.trial=n;this.trialStep=0;this.trialDone=false}
 resetTraining(){this.training={damage:0,best:0,hits:0,bestCombo:0};this.trialStep=0;this.trialDone=false;this.resetRound()}
 showBeat(phase:'before'|'after'){const rival=this.rivals[Math.min(this.opponent,this.rivals.length-1)],chapter=STORY[rival],me=ROSTER.find(r=>r.id===this.selected)!;
  const last=this.opponent>=this.rivals.length-1;this.beat={chapter:this.opponent+1,place:chapter.place,title:phase==='before'?`CHAPTER ${this.opponent+1} OF ${this.rivals.length}`:last?'OATH TAKEN':'CHAPTER CLEARED',text:phase==='before'?(this.opponent===0?`${STORY_INTRO} ${chapter.before}`:chapter.before):last?`${chapter.after} ${STORY_END}`:`${chapter.after} ${me.name} presses on.`};this.state='story';this.shots=[]}
 advance(){if(this.state!=='story')return;if(this.beat?.title==='CHAPTER CLEARED'||this.beat?.title==='OATH TAKEN'){if(this.opponent>=this.rivals.length-1){this.state='champion';this.beat=null;return}this.opponent++;this.round=1;this.wins=[0,0];this.showBeat('before');return}this.resetRound()}
 resetRound(hp=100){this.fighters=[body(this.selected,-3,1,hp),body(this.rival,3,-1)];this.shots=[];this.motions=[motion(),motion()];this.brains=[brain(),brain()];this.notice='';this.noticeTime=0;this.time=60;this.intro=this.mode==='training'?.4:1.2;this.state='fight';this.message=this.mode==='training'?'TRAINING':this.mode==='survival'?`RIVAL ${this.streak+1}`:`ROUND ${this.round}`;this.impact=0;this.hitstop=0;this.shake=0;this.events=[];if(this.mode==='training'){this.fighters[0].meter=100;this.fighters[1].meter=100}}
 next(){if(this.state==='round'){this.round++;this.resetRound(this.mode==='survival'?this.fighters[0].hp||100:100)}else if(this.state==='match'){if(this.wins[0]>=this.need){
   if(this.mode==='story'){this.showBeat('after');return}
   if(this.mode==='versus'){this.round=1;this.wins=[0,0];this.resetRound();return}
   // survival: the next rival in a loop, a little health back
   if(this.mode==='survival'){this.streak++;const hp=Math.min(100,this.fighters[0].hp+30);this.opponent=(this.opponent+1)%this.rivals.length;this.round=1;this.wins=[0,0];this.resetRound(hp);return}
   if(this.opponent===this.rivals.length-1){this.state='champion';return}this.opponent++;this.round=1;this.wins=[0,0];this.resetRound()}else{this.round=1;this.wins=[0,0];this.resetRound()}}}
 pause(){if(this.state==='fight')this.state='paused';else if(this.state==='paused')this.state='fight'}
 random(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296}
 cost(a:Attack){return a==='special'?SPECIAL_COST:a==='rising'?RISING_COST:a==='super'?SUPER_COST:0}
 say(text:string,time=.85){this.notice=text;this.noticeTime=time}
 event(e:FightEvent){this.events.push(e);if(this.events.length>48)this.events.shift()}
 /** Starts an attack. `cancel` lets a connected jab or kick be cut short by the next link of its chain. */
 attack(i:0|1,a:Attack,cancel=false){const f=this.fighters[i];if(!this.active||this.intro>0||f.stun>0||f.bstun>0||f.grabbed>0||f.grab>0||f.block||f.meter<this.cost(a))return false;
  if(cancel){if(!f.attack||!f.landed||f.attackTime<.1||!CANCELS[f.attack]?.includes(a))return false}else if(f.cooldown>0)return false;
  if((a==='rising'||a==='super'||a==='throw')&&f.y>0)return false;
  f.attack=a;f.attackTime=0;f.hit=false;f.landed=false;f.attackId=this.nextAttack++;f.cooldown=a==='jab'?.33:a==='kick'?.55:a==='rising'?.7:a==='super'?1.4:a==='throw'?.65:.8;f.meter-=this.cost(a);
  if(a==='rising'){f.vy=RISERS[f.id].lift;f.rising=.45}
  if((i===0||this.mode==='versus')&&a!=='jab'&&a!=='kick'&&a!=='throw'){this.say(moveName(f.id,a).toUpperCase(),a==='super'?1.3:.85);this.motions[i].stage=0;this.motions[i].rise=0}
  return true}
 /** A hit from side `owner` worth `amount`, from `move`, coming from x = `from`. Blocks, chip, guard, combos, scaling and hit-stop all happen here. */
 damage(owner:0|1,amount:number,move:Attack='jab',from?:number,attackId=0){const a=this.fighters[owner],o=(owner===0?1:0) as 0|1,b=this.fighters[o],fx=from??a.x,dir=Math.sign(b.x-fx)||a.facing,H=HIT[move];
  if(attackId&&a.attackId===attackId)a.landed=true;
  const blocked=move!=='throw'&&b.block&&b.y===0&&b.facing===-dir;
  if(blocked){
   const chip=move==='special'||move==='super'?amount*CHIP:0;b.hp=Math.max(0,b.hp-chip);b.bstun=Math.max(b.bstun,H.block);b.block=true;b.meter=Math.min(100,b.meter+4);a.meter=Math.min(100,a.meter+2);
   b.guard-=amount*1.3;b.guardRest=.9;b.x=clamp(b.x+dir*.25);this.hitstop=Math.max(this.hitstop,H.stop*.6);this.shake=Math.max(this.shake,H.shake*.4);
   this.event({kind:'block',owner,move,x:b.x-dir*.35,y:b.y+1});
   if(b.guard<=0){b.guard=GUARD_MAX*.5;b.bstun=0;b.block=false;b.stun=1.1;b.guardRest=1.1;this.hitstop=Math.max(this.hitstop,.12);this.shake=Math.max(this.shake,.18);this.impact=.2;this.say('GUARD BREAK!',1);this.event({kind:'guardbreak',owner,move,x:b.x,y:b.y+1.2})}
   return}
  // a hit links while the target is still reeling (or still in the air from one)
  const linked=a.comboTime>0&&(b.stun>0||b.y>0||b.grabbed>0);a.combo=linked?a.combo+1:1;const scale=Math.max(.4,1-.12*(a.combo-1)),dealt=amount*scale;
  b.hp=Math.max(0,b.hp-dealt);b.flash=.14;b.stun=H.stun;b.bstun=0;b.attack=b.attack==='throw'?null:b.attack;b.grabbed=0;
  if(move==='rising'&&b.y===0)b.vy=Math.max(b.vy,5.5);
  if(move!=='throw')b.x=clamp(b.x+dir*.2);
  a.comboTime=.9;a.meter=Math.min(100,a.meter+8);b.meter=Math.min(100,b.meter+3);this.impact=.1;this.hitstop=Math.max(this.hitstop,H.stop);this.shake=Math.max(this.shake,H.shake);
  if(this.mode==='training'&&owner===0){this.training.hits++;this.training.damage=a.combo>1?this.training.damage+dealt:dealt;this.training.best=Math.max(this.training.best,this.training.damage);this.training.bestCombo=Math.max(this.training.bestCombo,a.combo);this.trialHit(move,attackId,a.combo>1)}
  this.event({kind:move==='throw'?'throw':'hit',owner,move,x:b.x-dir*.3,y:b.y+1,combo:a.combo,damage:dealt});
  if(b.hp<=0)this.event({kind:'ko',owner,move,x:b.x,y:b.y+1})}
 /** Combo trials: each hit of the player's combo moves the trial on, a new attack at a time. */
 trialHit(move:Attack,attackId:number,linked:boolean){if(this.trial<0)return;const moves=TRIALS[this.trial].moves;
  if(attackId&&attackId===this.trialLast)return;this.trialLast=attackId;
  if(!linked)this.trialStep=0;
  if(moves[this.trialStep]===move)this.trialStep++;else this.trialStep=moves[0]===move?1:0;
  if(this.trialStep>=moves.length){this.trialDone=true;this.trialStep=0;this.say('TRIAL CLEAR!',1.2);this.event({kind:'trial',owner:0,x:this.fighters[1].x,y:2})}}
 finish(){this.result=this.fighters[0].hp===this.fighters[1].hp?2:this.fighters[0].hp>this.fighters[1].hp?0:1;if(this.result!==2)this.wins[this.result]++;
  const two=this.mode==='versus';this.message=this.result===2?'DRAW — REMATCH':this.result===0?(two?'PLAYER 1 WINS':'YOU WIN'):(two?'PLAYER 2 WINS':'RIVAL WINS');this.shots=[];
  if(this.mode==='survival'&&this.result===1){this.state='result';this.message=`${this.streak} DEFEATED`;return}
  this.state=this.wins.some(w=>w>=this.need)?'match':'round'}
 /** The CPU for side i: reads the fight and returns what it presses this frame. */
 think(i:0|1,dt:number,level:Difficulty):Input{const L=DIFFICULTY[level],me=this.fighters[i],o=this.fighters[i===0?1:0],br=this.brains[i],d=Math.abs(o.x-me.x),dir=Math.sign(o.x-me.x)||me.facing;
  const r=()=>this.random();let inp:Input={move:d>1.7?dir:d<1?-dir:0};
  br.clock-=dt;const decide=br.clock<=0;
  if(decide){br.clock=L.tick[0]+r()*(L.tick[1]-L.tick[0]);br.guard=r()<L.guard;br.antiAir=r()<L.antiAir;br.dodge=r()<L.dodge;br.punish=r()<L.punish;br.tech=r()<L.tech;br.jumpIn=r()<.08}
  // keep a connected chain going
  if(me.attack&&me.landed&&me.attackTime>=.1&&br.combo){const next=me.attack==='jab'?'kick':me.attack==='kick'?(me.meter>=SUPER_COST&&level==='hard'?'super':me.meter>=SPECIAL_COST?'special':o.y>0&&me.meter>=RISING_COST?'rising':null):null;if(next){br.combo=me.attack==='jab';return {move:0,[next]:true}}}
  if(me.stun>0||me.bstun>0)return {move:0,block:me.bstun>0};
  // a fireball coming: jump it or guard it
  const shot=this.shots.find(s=>s.owner!==i&&s.delay===0&&Math.sign(me.x-s.x)===s.dir&&Math.abs(me.x-s.x)<3.4);
  if(shot&&br.dodge&&me.y===0&&!me.attack){const gap=Math.abs(me.x-shot.x)-shot.radius;if(shot.y<.5&&gap<1.7&&gap>.75)return {move:0,jump:true};return {move:0,block:true}}
  // anti-air a jump-in
  if(br.antiAir&&o.y>.5&&d<2.7&&me.y===0&&!me.attack){br.antiAir=false;return me.meter>=RISING_COST?{move:0,rising:true}:{move:0,jab:true}}
  // break a throw
  if(br.tech&&me.grabbed>0&&me.grabbed<.16){br.tech=false;return {move:0,throw:true}}
  // punish a big move that missed or was blocked
  if(br.punish&&o.attack&&['special','rising','super'].includes(o.attack)&&o.attackTime>.3&&o.y===0&&d<2.4){br.punish=false;br.combo=r()<L.cancel;return {move:0,kick:true}}
  // guard a close normal
  if(br.guard&&o.attack&&(o.attack==='jab'||o.attack==='kick')&&d<2.6&&!o.hit&&me.y===0)return {move:0,block:true};
  if(me.y>.3&&d<2.1&&!me.attack&&me.vy<0)return {move:0,kick:true};
  // walking in for a throw
  br.grab=Math.max(0,br.grab-dt);if(br.grab>0&&!me.attack&&me.y===0){if(d>1.25)return {move:dir};br.grab=0;return {move:0,throw:true}}
  if(!decide)return inp;
  const n=r();br.combo=r()<L.cancel;
  if(d<2.6&&o.y===0&&n<L.throw){br.grab=.6;return {move:dir}}
  if(br.jumpIn&&d>2&&d<4&&me.y===0)return {move:dir,jump:true};
  if(d<1.85)return {...inp,jab:n<.6,kick:n>=.6};
  if(d<2.35)return {...inp,kick:true};
  if(me.meter>=SUPER_COST&&d>2&&n<.5)return {...inp,super:true};
  if(d>2.6&&me.meter>=SPECIAL_COST&&n<L.zone)return {...inp,special:true};
  if(level==='easy'&&n>.85)return {move:-dir};
  return inp}
 step(dt:number,input:Input=empty,rivalInput?:Input){if(!this.active)return;dt=Math.min(dt,1/60);this.impact=Math.max(0,this.impact-dt);this.shake=Math.max(0,this.shake-dt*.5);
  if(this.intro>0){this.intro=Math.max(0,this.intro-dt);this.message=this.intro>.5?(this.mode==='survival'?`RIVAL ${this.streak+1}`:`ROUND ${this.round}`):'FIGHT!';return}
  // hit-stop: everything freezes for a beat when a blow lands
  if(this.hitstop>0){this.hitstop=Math.max(0,this.hitstop-dt);
   // presses during the freeze still count: that is when players mash the next button
   ([input,rivalInput] as (Input|undefined)[]).forEach((c,i)=>{if(!c||i===0&&this.demo)return;const m=this.motions[i];for(const k of ['jab','kick','special','rising','super','throw'] as Attack[])if(c[k]&&!m.prev[k])m.buf[k]=.15;if(c.jab&&!m.prev.jab)m.lastJab=this.t;if(c.kick&&!m.prev.kick)m.lastKick=this.t;m.prev={...c}});
   return}
  this.t+=dt;if(this.mode!=='training')this.time=Math.max(0,this.time-dt);if(this.mode==='timeattack')this.clock+=dt;this.message='';this.noticeTime=Math.max(0,this.noticeTime-dt);
  const [p,r]=this.fighters;
  let ai:Input=rivalInput??empty;if(this.ai&&!rivalInput)ai=this.think(1,dt,this.difficulty);
  if(this.mode==='training'&&!rivalInput){ai=this.dummy==='stand'?{move:0}:this.dummy==='block'?{move:0,block:true}:this.dummy==='jump'?{move:0,jump:r.y===0}:ai}
  const inputs:[Input,Input]=[this.demo?this.think(0,dt,this.demo):input,ai];
  for(const [i,f]of this.fighters.entries()){const n=i as 0|1,other=this.fighters[i===0?1:0],m=this.motions[i],c=inputs[i],profile=ROSTER.find(q=>q.id===f.id)!;
   // motion inputs, read from this fighter's side: ↓ ↘ → is a fireball, → ↓ ↘ a rising attack
   const forward=c.move*f.facing>0;m.time=Math.max(0,m.time-dt);if(m.time===0)m.stage=0;
   if(c.down&&!forward&&m.stage===0){m.stage=1;m.time=.55}else if(c.down&&forward&&m.stage===1){m.stage=2;m.time=.55}else if(!c.down&&forward&&m.stage===2){m.stage=3;m.time=.35}
   m.riseTime=Math.max(0,m.riseTime-dt);if(m.riseTime===0)m.rise=0;
   if(forward&&!c.down&&m.rise===0){m.rise=1;m.riseTime=.4}else if(c.down&&!forward&&m.rise===1){m.rise=2;m.riseTime=.4}else if(c.down&&forward&&m.rise===2){m.rise=3;m.riseTime=.35}
   let ctl=c;if(m.rise===3&&c.jab)ctl={...c,jab:false,rising:true};else if(m.stage===3&&c.jab)ctl={...c,jab:false,special:true};
   if(n===0||this.mode==='versus'){const me=f.meter;if(ctl.super&&me<SUPER_COST&&!m.prev.super)this.say('NEED 100 POWER',.4);else if(ctl.special&&me<SPECIAL_COST&&!m.prev.special)this.say('NEED 35 POWER',.4);else if(ctl.rising&&me<RISING_COST&&!m.prev.rising)this.say('NEED 20 POWER',.4)}
   // presses are buffered briefly, so a tap during an attack still comes out (and can cancel)
   for(const k in m.buf){const key=k as Attack;m.buf[key]=Math.max(0,m.buf[key]!-dt)}
   const pressed=(k:Attack)=>!!ctl[k]&&!m.prev[k];
   for(const k of ['jab','kick','special','rising','super','throw'] as Attack[])if(pressed(k))m.buf[k]=.15;
   if(pressed('jab'))m.lastJab=this.t;if(pressed('kick'))m.lastKick=this.t;
   // jab and kick together is a throw
   if((pressed('jab')||pressed('kick'))&&Math.abs(m.lastJab-m.lastKick)<.06){m.buf.throw=.15;m.buf.jab=0;m.buf.kick=0;if((f.attack==='jab'||f.attack==='kick')&&f.attackTime<.07&&!f.hit){f.attack=null;f.cooldown=0}}
   if(m.buf.throw)f.tech=.25;
   m.prev={...ctl};
   f.facing=other.x>=f.x?1:-1;f.slow=Math.max(0,f.slow-dt);f.stun=Math.max(0,f.stun-dt);f.bstun=Math.max(0,f.bstun-dt);f.cooldown=Math.max(0,f.cooldown-dt);f.flash=Math.max(0,f.flash-dt);f.tech=Math.max(0,f.tech-dt);
   f.comboTime=Math.max(0,f.comboTime-dt);if(f.comboTime===0)f.combo=0;
   f.meter=Math.min(100,f.meter+7*dt);f.guardRest=Math.max(0,f.guardRest-dt);if(f.guardRest===0)f.guard=Math.min(GUARD_MAX,f.guard+30*dt);
   f.block=f.bstun>0||!!ctl.block&&f.y===0&&!f.attack&&f.stun===0&&f.grabbed===0;
   f.rising=Math.max(0,f.rising-dt);
   if(f.stun===0&&f.bstun===0&&f.grabbed===0&&f.grab===0){if(ctl.jump&&f.y===0&&!f.block&&!f.attack){f.vy=7.2}
    const want=(k:Attack)=>!!ctl[k]||(m.buf[k]??0)>0;
    for(const k of ['super','rising','special','throw','jab','kick'] as Attack[]){if(!want(k))continue;const cancel=(m.buf[k]??0)>0&&!!f.attack&&f.landed;if(this.attack(n,k,cancel)){m.buf[k]=0;break}}
    if(!f.block&&!f.attack){const nx=clamp(f.x+Math.max(-1,Math.min(1,ctl.move))*profile.speed*(f.slow>0?.55:1)*dt);if(Math.abs(nx-other.x)>1.05||Math.abs(f.y-other.y)>.9||Math.abs(nx-other.x)>Math.abs(f.x-other.x))f.x=nx}}
   // a grabbed fighter can still break free with jab + kick
   if(f.grabbed>0&&m.buf.throw){this.breakThrow();continue}
   f.vy-=19*dt;f.y=Math.max(0,f.y+f.vy*dt);if(f.y===0)f.vy=0;
   if(f.grab>0){f.grab=Math.max(0,f.grab-dt);if(f.grab===0&&other.grabbed>0){other.grabbed=0;this.damage(n,THROW_DAMAGE*profile.power,'throw',f.x,f.attackId);other.x=clamp(f.x+f.facing*1.9);other.vy=5}}
   if(f.attack){f.attackTime+=dt;
    if(f.attack==='throw'){if(!f.hit&&f.attackTime>=.08){f.hit=true;if(Math.abs(f.x-other.x)<THROW_RANGE&&other.y===0&&f.y===0&&other.stun===0&&other.grabbed===0&&other.attack!=='rising'){if(other.tech>0||other.attack==='throw'&&!other.hit)this.breakThrow();else{f.grab=.22;other.grabbed=.22;other.attack=null;other.block=false;other.bstun=0}}else this.event({kind:'whiff',owner:n,move:'throw',x:f.x+f.facing,y:1})}if(f.attackTime>.55)f.attack=null}
    else{if(!f.hit&&f.attackTime>=.12){f.hit=true;if(f.attack==='special'){const spec=SPECIALS[f.id];for(const spread of f.id==='owl'?[-.65,0,.65]:[0])this.shots.push({x:f.x+f.facing*.8,y:f.y+(f.id==='snake'?.28:.9),dir:f.facing,owner:n,life:3.2,kind:f.id,speed:spec.speed,damage:spec.damage,radius:spec.radius,vy:spread,delay:0,move:'special',attackId:f.attackId})}else if(f.attack==='super'){const sup=SUPERS[f.id];for(let k=0;k<sup.hits;k++)this.shots.push({x:f.x+f.facing*.8,y:f.y+(f.id==='snake'?.28:.9)+(f.id==='owl'?(k%3-1)*.5:0),dir:f.facing,owner:n,life:3.6,kind:f.id,speed:sup.speed,damage:sup.damage*profile.power,radius:sup.radius,vy:0,delay:k*.14,move:'super',attackId:f.attackId})}else if(f.attack==='rising'){if(Math.abs(f.x-other.x)<2.1&&other.y-f.y<2.4&&other.y-f.y>-2.2)this.damage(n,RISERS[f.id].damage*profile.power,'rising',f.x,f.attackId)}else if(Math.abs(f.x-other.x)<(f.attack==='jab'?1.85:2.35)&&Math.abs(f.y-other.y)<.95)this.damage(n,(f.attack==='jab'?7:11)*profile.power,f.attack,f.x,f.attackId)}
     if(f.attackTime>(f.attack==='jab'?.25:f.attack==='rising'?.45:f.attack==='super'?.9:.4))f.attack=null}}
  }
  // fireballs: two that meet cancel out
  for(const s of this.shots)if(s.delay===0&&s.life>0)for(const t of this.shots)if(t.owner!==s.owner&&t.delay===0&&t.life>0&&Math.abs(s.x-t.x)<s.radius+t.radius&&Math.abs(s.y-t.y)<s.radius+t.radius+.2){s.life=0;t.life=0;this.event({kind:'clash',owner:s.owner,x:(s.x+t.x)/2,y:(s.y+t.y)/2})}
  for(const shot of this.shots){if(shot.delay>0){shot.delay=Math.max(0,shot.delay-dt);continue}if(shot.life<=0)continue;shot.x+=shot.dir*shot.speed*dt;shot.y+=shot.vy*dt;shot.life-=dt;const target=this.fighters[shot.owner===0?1:0];if(shot.life>0&&Math.abs(shot.x-target.x)<.4+shot.radius&&shot.y+shot.radius>target.y+.1&&shot.y-shot.radius<target.y+1.65){const guarded=target.block;this.damage(shot.owner,shot.damage,shot.move,shot.x-shot.dir,shot.attackId);if(shot.kind==='agent'&&!guarded)target.slow=1.3;shot.life=0}}
  this.shots=this.shots.filter(s=>s.life>0&&Math.abs(s.x)<8);
  if(this.mode==='training'){p.meter=100;if(r.hp<40){r.hp=100;r.stun=0;r.attack=null}if(p.hp<40)p.hp=100;if(p.comboTime===0&&this.training.damage>0)this.training.damage=0;return}
  if(p.hp<=0||r.hp<=0||this.time<=0)this.finish()}
 /** Both throws (or a throw and a break) meet: everyone springs apart. */
 breakThrow(){const [a,b]=this.fighters,dir=Math.sign(b.x-a.x)||1;for(const f of this.fighters){f.grab=0;f.grabbed=0;if(f.attack==='throw')f.attack=null;f.bstun=.25;f.cooldown=Math.max(f.cooldown,.25)}a.x=clamp(a.x-dir*.6);b.x=clamp(b.x+dir*.6);this.hitstop=Math.max(this.hitstop,.06);this.shake=Math.max(this.shake,.05);this.say('THROW BREAK!',.9);this.event({kind:'break',owner:0,x:(a.x+b.x)/2,y:1})}
}

// ---------- saving ----------
export const SAVE_KEY='paw-fighter-v1';
export type Medals={arcade:boolean;story:boolean;survival:number;time:number|null};
export type FighterProfile={medals:Record<FighterId,Medals>;story:Record<FighterId,number>;trials:Record<string,boolean>;difficulty:Difficulty;dummy:Dummy;alt:Partial<Record<FighterId,boolean>>};
const ids=()=>ROSTER.map(r=>r.id);
export function readProfile(text:string|null):FighterProfile{
 const p:FighterProfile={medals:Object.fromEntries(ids().map(id=>[id,{arcade:false,story:false,survival:0,time:null}])) as Record<FighterId,Medals>,story:Object.fromEntries(ids().map(id=>[id,0])) as Record<FighterId,number>,trials:{},difficulty:'normal',dummy:'stand',alt:{}};
 let raw:any=null;try{raw=text?JSON.parse(text):null}catch{raw=null}if(!raw||typeof raw!=='object'||raw.v!==1)return p;
 for(const id of ids()){const m=raw.medals?.[id];if(m){p.medals[id]={arcade:m.arcade===true,story:m.story===true,survival:Number.isFinite(m.survival)?Math.max(0,Math.floor(m.survival)):0,time:Number.isFinite(m.time)&&m.time>0?m.time:null}}const s=raw.story?.[id];if(Number.isFinite(s))p.story[id]=Math.max(0,Math.min(6,Math.floor(s)));if(raw.alt?.[id]===true&&p.medals[id].arcade)p.alt[id]=true}
 if(raw.trials&&typeof raw.trials==='object')for(const [k,v] of Object.entries(raw.trials))if(v===true&&/^[a-z]+:\d$/.test(k))p.trials[k]=true;
 if(['easy','normal','hard'].includes(raw.difficulty))p.difficulty=raw.difficulty;if(['stand','block','jump','fight'].includes(raw.dummy))p.dummy=raw.dummy;
 return p}
export const writeProfile=(p:FighterProfile)=>JSON.stringify({v:1,...p});
/** Folds what just happened into the profile: chapters cleared, the arcade and story medals, survival streaks, time attack bests and trials. Returns what is new, for the page to celebrate. */
export function record(p:FighterProfile,g:FighterGame):string[]{const id=g.selected,m=p.medals[id],news:string[]=[];
 if(g.mode==='story'&&g.beat&&(g.beat.title==='CHAPTER CLEARED'||g.beat.title==='OATH TAKEN')&&g.opponent+1>p.story[id])p.story[id]=g.opponent+1;
 if(g.state==='champion'&&g.mode==='story'&&!m.story){m.story=true;news.push('STORY MEDAL')}
 if(g.state==='champion'&&g.mode==='arcade'&&!m.arcade){m.arcade=true;news.push('ARCADE MEDAL · ALTERNATE COLOURS UNLOCKED')}
 if(g.state==='champion'&&g.mode==='timeattack'&&(m.time===null||g.clock<m.time)){m.time=Math.round(g.clock*100)/100;news.push('NEW BEST TIME')}
 if(g.state==='result'&&g.mode==='survival'&&g.streak>m.survival){m.survival=g.streak;news.push('NEW BEST STREAK')}
 if(g.mode==='training'&&g.trialDone&&g.trial>=0){const k=`${id}:${g.trial}`;if(!p.trials[k]){p.trials[k]=true;news.push('TRIAL CLEARED')}}
 return news}
