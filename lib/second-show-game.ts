import {
  gridSpots, moveActions, edgeKey, totalTurns, secret, wait, distance,
  type Action, type Edge, type Difficulty, type Mission, type Rules, type State, type View,
} from './arcade-originals-rules.js';

type Act = Mission & { murals:number[]; inspector:number; traps:number; applause:number; origin:number };
type Show = State & {
  dora:number; enzo:number; rolls:number[]; carried:number; trap:boolean;
  applause:number; alarm:number; lastCue:string; keepsake:number; difficulty:Difficulty;
  doraMove:string; enzoMove:string;
};
const spots=gridSpots(['Apron','Wave mark','Curtain','Quick change','Fly loft','Rigging desk','Stage door','Trap landing','Picture rack']);
const fronts:Edge[]=[[0,1],[1,2]];
const backs:Edge[][]=[
  [[3,4],[4,5],[3,6],[6,7],[7,8],[5,8]],
  [[3,4],[4,7],[7,6],[7,8],[8,5],[5,4]],
  [[3,6],[6,7],[7,4],[4,5],[5,8],[7,8]],
  [[3,4],[4,5],[5,8],[8,7],[7,6],[6,3],[4,7]],
];
const shortcut:Edge=[5,7];
const schedules=[[3,5,7,8,4,6],[5,8,4,3,7,6],[7,4,8,5,6,3],[8,5,7,4,3,6]];
const cues=[
  {id:'bow',text:'Take a bow',to:0},
  {id:'wave',text:'Roll in the painted wave',to:1},
  {id:'curtain',text:'Draw back the curtain',to:2},
];
const scripts: [string,string,number[],number,number,number,number,number,number][]=[
  ['Places, please','Give the audience a bow while Enzo wheels the first picture out.',[8],0,0,1,7,13,7],
  ['Between the ropes','An inspector watches the fly loft. Put a new cue where they can see it.',[5],1,0,2,4,14,8],
  ['The house lights','The trapdoor is locked. Rig it from the desk or take the gallery stairs.',[8],2,1,3,3,16,10],
  ['A boat made of plywood','Take a scene change all the way from the quay to the stage door.',[5,8],1,1,4,7,21,13],
  ['The picture gallery','The guests think they are seeing reproductions. Keep them watching the stage.',[4],2,0,3,6,15,9],
  ['The night custodian','An usher paces the stairs while another painting waits in the rack.',[8,4],0,1,4,3,21,13],
  ['The cloth screen','Move the scenery in a different order to keep the house from growing restless.',[7,5],3,1,5,4,22,14],
  ['A borrowed masterpiece','The inspector knows the bow already. Give them something new to watch.',[5,8],4,1,5,6,22,14],
  ['All aboard','The stage has moved onto a train. The wings are narrow and the fly loft is busy.',[5],2,0,4,7,17,10],
  ['Through the tunnel','The train pauses. Use a curtain cue to get the second picture out.',[4,8],4,1,5,6,22,14],
  ['The narrow carriage','There is room for one picture at a time. Choose which one goes down first.',[7,8],3,1,6,4,23,15],
  ['Last stop for the troupe','Two scenery carts are waiting and the inspector is coming down the aisle.',[4,5,8],1,2,6,7,28,17],
  ['The civic gala','Begin with a modest bow. The inspector will be watching the far wing.',[5,8],0,1,6,6,23,14],
  ['The mayor’s entrance','The second roll has to pass the stage door while the house is still clapping.',[7,8],2,1,7,3,24,15],
  ['A house full of eyes','The aisle is narrow, and a repeated cue won’t turn a head.',[4,5,8],3,2,8,6,29,18],
  ['The second show','The audience is in on it now. Save the last murals and give the city a final curtain.',[5,7,8],1,2,9,3,31,20],
];
export const ACTS:Act[]=scripts.map(([title,story,murals,inspector,traps,applause,origin,limit,par],i)=>({title,story,murals,inspector,traps,applause,origin,limit,par,chapter:Math.floor(i/4)}));
const gaze=(m:Act,t:number)=>schedules[m.chapter][(m.inspector+t)%6];
const alertLimit=(s:Show)=>s.difficulty==='expert'?2:s.difficulty==='story'?5:3;
function backstage(m:Act,s:Show) {
  const cut=edgeKey(...shortcut);
  const natural=backs[m.chapter].filter(e=>m.traps===0||edgeKey(...e)!==cut);
  return s.trap?[...natural,shortcut]:natural;
}
function actions(m:Act,s:Show,h:'dora'|'enzo'):Action[]{
  if(s.phase!=='playing')return [];
  if(h==='dora')return[wait,...moveActions(fronts,s.dora,spots,'Cross to'),...(cues[s.dora]?[cues[s.dora]]:[])];
  const result=[wait,...moveActions(backstage(m,s),s.enzo,spots,'Slip to')];
  if(!s.trap&&m.traps>0&&(s.enzo===5||(m.traps===1&&s.enzo===7)))result.push({id:'rig',text:'Rig the trapdoor',to:s.enzo});
  if(s.carried<0)s.rolls.forEach((p,i)=>{if(p===s.enzo)result.push({id:`take:${i}`,text:`Lift mural ${i+1}`,to:p});});
  if(s.carried>=0&&s.enzo===6)result.push({id:'drop',text:'Hand the mural to the troupe',to:6});
  if(!s.bonus&&s.enzo===s.keepsake)result.push({id:'keepsake',text:'Pocket the old playbill',to:s.enzo});
  return result;
}
function step(m:Act,s:Show,p:{dora:string;enzo:string}):Show{
  const n:Show={...s,turn:s.turn+1,notes:[],rolls:[...s.rolls],doraMove:p.dora,enzoMove:p.enzo};
  let cover=false;
  if(p.dora.startsWith('go:'))n.dora=Number(p.dora.slice(3));
  else if(cues.some(c=>c.id===p.dora)){
    if(s.lastCue!==p.dora){
      cover=true;n.applause++;n.lastCue=p.dora;
      n.notes.push({text:'The house follows Dora’s cue. The wings are clear this beat.',tone:'good'});
    }else n.notes.push({text:'The inspector has seen that cue. Try a different one.',tone:'warning'});
  }
  const [action,id]=p.enzo.split(':');
  const next=action==='go'?Number(id):s.enzo;
  const eye=gaze(m,s.turn);
  if(!cover&&action!=='wait'&&action!=='drop'&&next===eye){
    n.alarm++;n.notes.push({text:'The inspector looks into the wings. Enzo freezes before they see the mural.',tone:'warning'});
  }else if(action==='go')n.enzo=next;
  else if(action==='rig'){
    n.trap=true;n.notes.push({text:'The trapdoor gives you a shortcut between the desk and landing.',tone:'good'});
  }else if(action==='take'){n.carried=Number(id);n.rolls[Number(id)]=-2;}
  else if(action==='drop'){
    n.rolls[n.carried]=-1;n.carried=-1;
    n.notes.push({text:'Another mural is in the troupe’s cart.',tone:'good'});
  }else if(action==='keepsake'){n.bonus=true;n.notes.push({text:'A playbill from the theater’s first show goes into the collection.',tone:'good'});}
  if(n.rolls.every(p=>p===-1)&&n.applause>=m.applause)n.phase='clear';
  else if(n.alarm>=alertLimit(n)||n.turn>=totalTurns(m,n.difficulty))n.phase='lost';
  return n;
}
function view(m:Act,s:Show):View{
  const eye=gaze(m,s.turn),out=s.rolls.filter(p=>p===-1).length;
  return{
    dora:s.dora,enzo:s.enzo,
    doraPose:s.phase==='clear'?'victory':cues.some(c=>c.id===s.doraMove)?'ability':undefined,
    enzoPose:s.phase==='clear'?'victory':s.notes.some(n=>n.text.includes('freezes'))?'hurt':s.enzoMove==='rig'?'ability':/^(take:|drop|keepsake)/.test(s.enzoMove)?'interact':undefined,
    links:[...fronts,...backstage(m,s)].map(edge=>({edge,style:edgeKey(...edge)===edgeKey(...shortcut)&&s.trap?'linked':edge.includes(eye)?'hot':'open'})),
    marks:[{at:eye,art:4,label:'Inspector watches here',kind:'warning'},{at:6,art:7,label:'Exit with the mural',kind:'safe'},...(m.traps?[{at:7,art:2,label:s.trap?'Trapdoor open':'Trapdoor shut'}]:[])],
    actors:[{id:'inspector',at:2,art:0,name:'Inspector Corva'},...s.rolls.flatMap((p,i)=>p>=0||p===-2?[{id:`mural-${i}`,at:p===-2?s.enzo:p,art:1,name:`Mural ${i+1}`}]:[])],
    facts:[{label:'Murals out',value:`${out} / ${s.rolls.length}`},{label:'Applause',value:`${s.applause} / ${m.applause}`},{label:'Suspicion',value:`${s.alarm} / ${alertLimit(s)}`},{label:'Beats left',value:String(totalTurns(m,s.difficulty)-s.turn)}],
    objective:'Get every mural through Stage door and earn the required applause.',
    preview:`The inspector will watch ${spots[eye].name}. ${s.lastCue?`The last cue was ${s.lastCue}.`:'A new cue will turn their head.'}`,
    hint:s.carried>=0?'Guide Enzo to Stage door, then hand the mural out.':out===s.rolls.length?'Move Dora between the three stage marks and use different cues.':'A new cue from Dora covers Enzo for this beat. Queue one to three beats, then play them.',
  };
}
export const secondShow:Rules<Show,Act>={
  id:'second-show',title:'The Second Show',ending:'Corva looked up just in time for the curtain. Outside, the troupe unrolled the rescued murals so the whole city could see them.',caption:'Keep the house watching.',spots,
  chapterNames:['Quay theater','Picture gallery','Carriage stage','Civic gala'],
  chapters:['A bow can buy a beat in the wings.','A crowd learns your tricks. Change the cue.','Plan for one roll at a time in the narrow carriage.','Give the city the show it came to see.'],
  heroHelp:{dora:'Move between marks. A different cue earns applause and covers Enzo for one beat.',enzo:'Carry one mural at a time and hand it out at Stage door. Rig a shortcut when the desk is safe.'},
  stepLabel:'Play the scene',maxPlan:3,missions:ACTS,
  start(i,difficulty,seed){
    const m=ACTS[i];
    return{turn:0,phase:'playing',notes:[],bonus:false,dora:0,enzo:m.origin,rolls:[...m.murals],carried:-1,trap:false,applause:0,alarm:0,lastCue:'',keepsake:secret(i,seed,[3,4,7,8]),difficulty,doraMove:'',enzoMove:''};
  },
  actions:(i,s,h)=>actions(ACTS[i],s,h),
  step:(i,s,p)=>step(ACTS[i],s,p),
  view:(i,s)=>view(ACTS[i],s),
  rank(i,s){
    const m=ACTS[i],edges=backstage(m,s),done=s.rolls.filter(p=>p===-1).length;
    const dest=s.carried>=0?distance(edges,s.enzo,6):Math.min(...s.rolls.filter(p=>p>=0).map(p=>distance(edges,s.enzo,p)+distance(edges,p,6)/4),10);
    return done*65+(s.carried>=0?23:0)-dest*3+Math.min(m.applause,s.applause)*4-s.alarm*11-s.turn*.7+(s.bonus?.8:0)+(s.trap?.6:0);
  },
  signature:s=>[s.dora,s.enzo,s.rolls,s.carried,s.trap,s.applause,s.alarm,s.lastCue,s.bonus,s.turn].join('|'),
};
