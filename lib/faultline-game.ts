import {
  gridSpots, moveActions, edgeKey, totalTurns, secret, wait, distance, type Action, type Edge,
  type Difficulty, type Mission, type Rules, type State, type View,
} from './arcade-originals-rules.js';

type Rescue = Mission & { residents: number[]; shock: number; stones: number; enzo: number; wake: number };
type Faultline = State & {
  dora: number; enzo: number; carried: number; residents: number[]; braced: number;
  blocked: number[]; kits: number; ledger: number; difficulty: Difficulty; used: boolean;
};
const spots = gridSpots(['Relief camp', 'Upper walk', 'Lookout', 'Switchback', 'Pulley house', 'East stairs', 'Spill ledge', 'Lower span', 'Far shelter']);
const fixed: Edge[][] = [
  [[0,3],[3,6],[6,7],[7,8],[8,5],[5,2],[3,4],[4,7],[0,1]],
  [[0,3],[3,6],[6,7],[7,4],[4,5],[5,8],[8,2],[0,1],[1,4]],
  [[0,3],[3,4],[4,1],[1,2],[2,5],[5,8],[8,7],[7,6],[6,3]],
  [[0,1],[1,4],[4,3],[3,6],[6,7],[7,8],[8,5],[5,2],[2,1]],
];
const joints: Edge[][] = [
  [[1,2],[4,5],[3,7]],
  [[1,2],[3,4],[5,2]],
  [[0,1],[4,7],[5,4]],
  [[0,3],[4,7],[4,5]],
];
const routes = [
  ['First tremor', 'A neighbor is stranded beyond the upper walk. Keep that walk braced or take the long stairs.', [2], 0, 1, 4, 2, 10, 6],
  ['Two doors', 'A potter is waiting by the lookout and their apprentice is down on the spill ledge.', [2,6], 1, 1, 4, 3, 18, 12],
  ['The lunch bell', 'The lower span is quiet for one turn. Bring both workers home before dusk.', [5,8], 2, 0, 3, 2, 19, 13],
  ['Upper village', 'The high road and the pulley house are both taking the strain. Watch the arrows change.', [2,4,8], 0, 2, 4, 2, 25, 17],
  ['Mill at low water', 'A sluice keeper is waiting above the wheels. Decide which span gets the cable.', [5,1], 1, 1, 7, 2, 18, 12],
  ['Waterwheel shift', 'An empty mill race can serve as an escape route if the old short bridge gives way.', [2,8], 0, 1, 4, 1, 19, 13],
  ['The spill ledge', 'Three workers are split between both banks. The far shelter is safer than it looks.', [8,6,5], 2, 1, 4, 2, 26, 17],
  ['Cut the millrace', 'The mill roof is creaking. Save the two carpenters and their foreman in any order.', [1,2,8], 1, 2, 7, 1, 25, 17],
  ['Three knocks', 'There are voices across the west shaft. The marked braces are rated for just one joint at a time.', [4,7], 0, 1, 3, 2, 19, 12],
  ['Blue seam', 'The upper drift buckles if it takes the next shock without a brace.', [2,5], 2, 0, 4, 2, 20, 13],
  ['The cage stops', 'The miners have spread out to stay off the unstable span. Use the stone kit where it saves the most walking.', [8,7,1], 1, 1, 4, 1, 26, 18],
  ['The old winch', 'Three miners and a logbook are still below. You can bring the neighbors home without the book.', [8,5,6], 2, 2, 3, 1, 27, 18],
  ['Headwater', 'The sluice has been lowered, but its bridge is still taking water.', [5,7], 2, 1, 4, 2, 20, 13],
  ['Shutter crew', 'Two keepers are stranded far up the dam face. Plan one trip at a time.', [2,8], 1, 1, 1, 1, 21, 14],
  ['White water', 'The first shock comes early. Check the safe path before Dora takes on a passenger.', [7,8,2], 0, 1, 4, 1, 27, 18],
  ['Hold the headwaters', 'The crest is giving way. Bring the last crew home while Enzo shifts the load away from the spillway.', [2,5,8], 2, 2, 4, 1, 29, 18],
] as const;
export const RESCUES: Rescue[] = routes.map(([title, story, residents, shock, stones, enzo, wake, limit, par], i) =>
  ({ title, story, residents: [...residents], shock, stones, enzo, wake, limit, par, chapter: Math.floor(i / 4) }));
const shockAt = (m: Rescue, turn: number) =>
  turn < m.wake || (turn - m.wake) % 3 !== 0 ? -1 : (m.shock + (turn - m.wake) / 3) % 3;
function links(m: Rescue, s: Faultline) {
  const seen = new Set(fixed[m.chapter].map(([a,b]) => edgeKey(a,b)));
  return [...fixed[m.chapter], ...joints[m.chapter].filter(([a,b], i) => !s.blocked.includes(i) && !seen.has(edgeKey(a,b)))];
}
function actions(m: Rescue, s: Faultline, hero: 'dora' | 'enzo'): Action[] {
  if (s.phase !== 'playing') return [];
  const result = [wait, ...moveActions(links(m,s), s[hero], spots, hero === 'dora' && s.carried >= 0 ? 'Escort to' : 'Go to')];
  if (hero === 'dora') {
    if (s.carried < 0) s.residents.forEach((p,i) => { if (p === s.dora) result.push({id:`escort:${i}`,text:`Take ${['Mina','Tari','Sacha'][i]}’s paw`,to:p}); });
    if (!s.bonus && s.dora === s.ledger) result.push({id:'ledger',text:'Recover the village ledger',to:s.dora});
  } else {
    joints[m.chapter].forEach(([a,b], i) => {
      const label = `${spots[a].name} → ${spots[b].name}`;
      if (s.blocked.includes(i)) {
        if (s.kits && (s.enzo === a || s.enzo === b)) result.push({id:`patch:${i}`,text:`Shore up ${label}`,to:s.enzo,edge:[a,b]});
      } else if (s.braced !== i && (s.enzo === m.enzo || [a,b].includes(s.enzo))) result.push({id:`brace:${i}`,text:`Brace ${label}`,to:s.enzo,edge:[a,b]});
    });
  }
  return result;
}
function step(m: Rescue, s: Faultline, choice: { dora: string; enzo: string }): Faultline {
  const [a, i] = choice.dora.split(':'), [b, j] = choice.enzo.split(':');
  const n: Faultline = { ...s, turn: s.turn + 1, residents: [...s.residents], blocked: [...s.blocked], notes: [], used: b === 'brace' || b === 'patch' };
  if (b === 'go') n.enzo = +j;
  if (b === 'brace') {
    n.braced = +j;
    n.notes.push({text:'The cable takes the weight on its new anchor.',tone:'good'});
  }
  if (b === 'patch') {
    n.blocked = n.blocked.filter((x) => x !== +j); n.kits--; n.braced = +j;
    n.notes.push({text:'The stone kit opens the passage again.',tone:'good'});
  }
  if (a === 'go') n.dora = +i;
  if (a === 'escort') {
    n.carried = +i; n.residents[+i] = -2;
    n.notes.push({text:'A neighbor takes Dora’s paw.'});
  }
  if (a === 'ledger') {
    n.bonus = true;
    n.notes.push({text:'The village ledger is safe.',tone:'good'});
  }
  const threat = shockAt(m, n.turn);
  if (threat >= 0 && !n.blocked.includes(threat)) {
    const e = joints[m.chapter][threat];
    if (n.braced === threat) n.notes.push({text:'The brace held through the aftershock.',tone:'good'});
    else {
      n.blocked.push(threat);
      if (a === 'go' && edgeKey(s.dora,n.dora) === edgeKey(...e) && !fixed[m.chapter].some(([p,q]) => edgeKey(p,q) === edgeKey(...e))) n.dora = s.dora;
      n.notes.push({text:a === 'go' && n.dora !== +i ? 'The span slips. Dora steps back with her passenger.' : 'The aftershock closed an unbraced span.',tone:'warning'});
    }
  }
  if (n.dora === 0 && n.carried >= 0) {
    n.residents[n.carried] = -1; n.carried = -1;
    n.notes.push({text:'The relief camp welcomes another neighbor.',tone:'good'});
  }
  if (n.residents.every((p) => p === -1)) n.phase = 'clear';
  else if (n.turn >= totalTurns(m,n.difficulty)) n.phase = 'lost';
  return n;
}
function view(m: Rescue, s: Faultline): View {
  const danger = shockAt(m,s.turn+1), safe = s.residents.filter((p) => p === -1).length;
  const target = s.carried >= 0 ? 0 : s.residents.filter((p) => p >= 0)
    .sort((a,b) => distance(links(m,s),s.dora,a)-distance(links(m,s),s.dora,b))[0];
  return {
    dora:s.dora, enzo:s.enzo, enzoPose:s.phase==='clear'?'victory':s.used?'ability':undefined,
    doraPose:s.phase==='clear' ? 'victory' : s.notes.some(n=>n.text.includes('steps back')) ? 'hurt' : s.notes.some(n=>n.text.includes('takes Dora')) ? 'ability' : undefined,
    links:[...fixed[m.chapter].map(edge=>({edge,style:'open' as const})), ...joints[m.chapter].map((edge,i)=>({edge,style:s.blocked.includes(i)?'closed' as const : i===s.braced?'linked' as const : i===danger?'hot' as const : 'open' as const}))],
    marks:[{at:0,art:5,label:'Relief camp',kind:'safe'}, {at:m.enzo,art:3,label:'Remote winch'}, ...(danger>=0?[{at:joints[m.chapter][danger][1],art:2,label:'Aftershock forecast',kind:'warning' as const}]:[])],
    actors:s.residents.flatMap((p,i)=>p>=0||p===-2?[{id:`neighbor-${i}`,at:p===-2?s.dora:p,art:i===1?1:0,name:['Mina','Tari','Sacha'][i]}]:[]),
    facts:[{label:'At camp',value:`${safe} / ${s.residents.length}`},{label:'Stone kits',value:String(s.kits)},{label:'Turns left',value:String(totalTurns(m,s.difficulty)-s.turn)}],
    objective:s.carried>=0?'Guide your passenger back to Relief camp.':'Bring every neighbor to Relief camp.',
    preview:danger>=0?`Next shock: ${joints[m.chapter][danger].map(p=>spots[p].name).join(' → ')}${s.braced===danger?' (braced)':''}.`:'The next turn is quiet.',
    hint:target===s.dora&&s.carried<0?'Take the neighbor’s paw, then guide them home.':`Head toward ${spots[target ?? 0].name}. Enzo can brace from either end or the winch.`,
  };
}
export const faultline: Rules<Faultline,Rescue> = {
  id:'faultline',title:'Faultline Rescue',ending:'When the dam stopped shaking, the potters lit a fire at Relief camp. The last dam keeper put another kettle on. Everyone was accounted for.',caption:'Brace a route. Bring them home.',spots,
  chapterNames:['Pottery terraces','Millrace','Copper drift','Headwater dam'],
  chapters:['A safe route matters more than the shortest route.','The wheel crews know a lower way home.','Move the brace before moving the miners.','The whole valley depends on the last relief crew.'],
  heroHelp:{dora:'Choose a route, take a neighbor’s paw, and escort them to camp.',enzo:'Brace a span from a nearby anchor or the winch. One brace carries the load at a time.'},
  stepLabel:'Advance aftershock',maxPlan:1,missions:RESCUES,
  start(i,difficulty,seed) {
    const m=RESCUES[i];
    return {turn:0,phase:'playing',notes:[],bonus:false,dora:0,enzo:m.enzo,carried:-1,residents:[...m.residents],braced:-1,blocked:[],kits:m.stones+(difficulty==='story'?1:0),ledger:secret(i,seed,[3,4,6,7]),difficulty,used:false};
  },
  actions:(i,s,h)=>actions(RESCUES[i],s,h),
  step:(i,s,c)=>step(RESCUES[i],s,c),
  view:(i,s)=>view(RESCUES[i],s),
  rank(i,s) {
    const edges=links(RESCUES[i],s), rescued=s.residents.filter(p=>p===-1).length;
    const path=s.carried>=0?distance(edges,s.dora,0):Math.min(...s.residents.filter(p=>p>=0).map(p=>distance(edges,s.dora,p)+distance(edges,p,0)/3),12);
    return rescued*60+(s.carried>=0?16:0)-path*2-s.turn*.62+s.kits*.15+(s.bonus?1:0)+(s.braced===shockAt(RESCUES[i],s.turn+1)&&s.braced>=0?.8:0);
  },
  signature:s=>[s.dora,s.enzo,s.carried,s.residents,s.braced,s.blocked,s.kits,s.bonus,s.turn].join('|'),
};
