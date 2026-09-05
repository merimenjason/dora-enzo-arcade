export type Skill={id:string;hero:number;name:string;description:string;max:number;level:number;parent?:string;branch:string};
export const SKILLS:Skill[]=[
 {id:'seed',hero:0,name:'Keen seeds',description:'+15% seed damage per rank.',max:3,level:1,branch:'Marksmanship'},
 {id:'haste',hero:0,name:'Quick paws',description:'Basic seed attacks are 12% faster per rank.',max:3,level:2,parent:'seed',branch:'Marksmanship'},
 {id:'storm',hero:0,name:'Seedstorm',description:'Volley fires 2 extra seeds per rank.',max:2,level:4,parent:'haste',branch:'Marksmanship'},
 {id:'focus',hero:0,name:'Moon focus',description:'Volley recharges 15% faster per rank.',max:3,level:1,branch:'Mooncraft'},
 {id:'frost',hero:0,name:'Winter seeds',description:'Volley hits stun for 0.3 seconds per rank.',max:3,level:2,parent:'focus',branch:'Mooncraft'},
 {id:'nova',hero:0,name:'Lunar nova',description:'Volley also erupts around White for 35 damage per rank.',max:2,level:4,parent:'frost',branch:'Mooncraft'},
 {id:'claw',hero:1,name:'Iron claws',description:'+15% melee damage per rank.',max:3,level:1,branch:'Ravager'},
 {id:'cleave',hero:1,name:'Sweeping blows',description:'Basic attacks cleave nearby enemies for 20% damage per rank.',max:3,level:2,parent:'claw',branch:'Ravager'},
 {id:'whirl',hero:1,name:'Dust cyclone',description:'Whirling paws gains 0.6 range and 20% damage per rank.',max:2,level:4,parent:'cleave',branch:'Ravager'},
 {id:'guard',hero:1,name:'Thick fur',description:'Both heroes take 6% less damage per rank.',max:3,level:1,branch:'Guardian'},
 {id:'vigor',hero:1,name:'Stout hearts',description:'+25 maximum courage and healing per rank.',max:3,level:2,parent:'guard',branch:'Guardian'},
 {id:'bond',hero:1,name:'Unbreakable',description:'Team burst costs 5 less bond and heals 15 courage per rank.',max:2,level:4,parent:'vigor',branch:'Guardian'},
];
