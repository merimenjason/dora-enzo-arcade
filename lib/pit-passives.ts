export const PASSIVES={
 shell:{name:'Pebble Locket',description:'Take 15% less contact damage per rank.',color:'#aebfe0'},
 clock:{name:'Pocket Sundial',description:'Projectiles last 1 second longer per rank.',color:'#e4cb8d'},
 boots:{name:'Silk Slippers',description:'Dora and Enzo move 12% faster per rank.',color:'#b5dcb9'},
 ribbon:{name:'Friendship Ribbon',description:'Each defeat grants 2 extra bond per rank.',color:'#d9b0e5'},
 clover:{name:'Lucky Clover',description:'Predators drop 15% more XP per rank.',color:'#9acb8c'},
 hay:{name:'Healing Hay',description:'Recover 0.4 courage per second per rank during combat.',color:'#ddb777'},
};
export type PassiveKind=keyof typeof PASSIVES;
