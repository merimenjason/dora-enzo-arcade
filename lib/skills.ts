export type Skill={id:string;hero:number;name:string;description:string;max:number;level:number;parent?:string;branch:string};
export const STANCES=[{id:'smash',name:'Boulder Paw',description:'Heavy blows: +20% melee damage per rank; slower attacks.'},{id:'thrust',name:'Reed Fang',description:'Precise strikes: +0.6 melee reach per rank.'},{id:'pillar',name:'Rooted Tail',description:'Sweeping guard: 25% cleave damage and 10% less incoming damage per rank while Grey leads.'}] as const;
export type Stance=typeof STANCES[number]['id'];
export const SKILLS:Skill[]=[
 {id:'hush',hero:0,name:'Whisker Seal',description:'Volley seeds immobilize enemies for 0.7 seconds per rank. Guardians resist half the duration.',max:3,level:1,branch:'Stillness'},
 {id:'brittle',hero:0,name:'Cracking Silence',description:'Both heroes deal 20% more damage per rank to immobilized enemies.',max:3,level:2,parent:'hush',branch:'Stillness'},
 {id:'sanctuary',hero:0,name:'Silent Burrow',description:'Volley also immobilizes visible enemies within 4 steps for 1 second per rank.',max:2,level:4,parent:'brittle',branch:'Stillness'},
 {id:'decoy',hero:0,name:'Dust Double',description:'Volley leaves a decoy for 4 seconds, drawing nearby attacks. 35 courage. Recharges in 10 seconds.',max:1,level:1,branch:'Dustcraft'},
 {id:'lingering',hero:0,name:'Borrowed Shape',description:'Decoy lasts 2 seconds longer and gains 15 courage per rank.',max:2,level:2,parent:'decoy',branch:'Dustcraft'},
 {id:'echo',hero:0,name:'Parting Puff',description:'When the decoy breaks or expires, it deals 25 damage per rank to visible enemies within 3 steps.',max:3,level:4,parent:'lingering',branch:'Dustcraft'},
 {id:'smash',hero:1,name:'Boulder Paw',description:'Unlock a heavy stance: +20% melee damage per rank, with slower basic attacks. Equip below.',max:3,level:1,branch:'Paw Stances'},
 {id:'thrust',hero:1,name:'Reed Fang',description:'Unlock a reaching stance: +0.6 melee reach per rank. Equip below.',max:2,level:2,parent:'smash',branch:'Paw Stances'},
 {id:'pillar',hero:1,name:'Rooted Tail',description:'Unlock a guard stance: 25% cleave damage and 10% damage reduction per rank while Grey leads. Equip below.',max:2,level:4,parent:'thrust',branch:'Paw Stances'},
 {id:'stonefur',hero:1,name:'Stonefur Spirit',description:'Whirling paws transforms Grey: +25% melee damage, 20% damage reduction while leading. Lasts 4/6 seconds. Recharges in 12 seconds.',max:2,level:1,branch:'Spirit Form'},
 {id:'ironhide',hero:1,name:'Mountain Coat',description:'Stonefur reduces incoming damage by an extra 5% per rank while Grey leads.',max:3,level:2,parent:'stonefur',branch:'Spirit Form'},
 {id:'return',hero:1,name:'Gentle Return',description:'When Stonefur ends, restore 15 shared courage per rank.',max:3,level:4,parent:'ironhide',branch:'Spirit Form'},
];
