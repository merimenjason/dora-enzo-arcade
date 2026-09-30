// Chinchilla Scribble's dictionary: every noun the game can summon, every adjective that changes one, and the parser
// that turns what the player writes ("a giant flying hay bale") into a noun plus its adjectives.

export type Tag =
  | 'solid' // things can stand on its top
  | 'wall' // blocks movement from the side too
  | 'climb' | 'fly' | 'ride' | 'drive' | 'boat' | 'hang' | 'jumper'
  | 'float' | 'burn' | 'flame' | 'hot' | 'warm' | 'cold' | 'wet' | 'rain' | 'light'
  | 'food' | 'plant' | 'meat' | 'brain'
  | 'bouncy' | 'explode' | 'break' | 'trap' | 'scary' | 'alive' | 'sticky' | 'ghost'
  | 'stairs' | 'arc' | 'canopy' | 'soft';

export type Noun = {
  id: string; words: string[]; w: number; h: number; tags: Tag[]; mass: number;
  /** Drawing key in lib/scribble-art.ts; several nouns share one with a different colour. */
  art: string; color: string; speed: number;
};

const n = (words: string, w: number, h: number, tags: string, o: { mass?: number; art?: string; color?: string; speed?: number } = {}): Noun => {
  const list = words.split('|');
  return {
    id: list[0], words: list, w, h, tags: tags.split(' ').filter(Boolean) as Tag[],
    mass: o.mass ?? Math.min(4, Math.max(0.5, Math.round((w * h) / 4000))),
    art: o.art ?? list[0], color: o.color ?? '', speed: o.speed ?? 0,
  };
};

export const NOUNS: Noun[] = [
  // Climbing, bridging and building
  n('ladder', 56, 230, 'solid climb burn float', { mass: 2 }),
  n('stairs|staircase|steps|stair', 170, 120, 'solid stairs burn', { mass: 4 }),
  n('plank|board|beam|wooden plank', 190, 16, 'solid burn float', { mass: 1 }),
  n('bridge', 290, 26, 'solid burn float', { mass: 3 }),
  n('log|tree trunk', 150, 40, 'solid burn float', { mass: 3 }),
  n('rope', 16, 240, 'climb burn', { mass: 0.5 }),
  n('vine|ivy', 22, 240, 'climb burn plant', { mass: 0.5 }),
  n('beanstalk|bean stalk', 46, 420, 'climb burn plant', { mass: 2 }),
  n('crate|wooden crate', 70, 70, 'solid burn float', { mass: 2 }),
  n('box|cardboard box|parcel|package', 64, 54, 'solid burn float', { mass: 1 }),
  n('block|toy block|cube', 60, 60, 'solid', { mass: 2, color: '#ef6a5a' }),
  n('brick|bricks', 54, 28, 'solid', { mass: 2 }),
  n('barrel', 56, 72, 'solid burn float', { mass: 3 }),
  n('table|desk', 116, 72, 'solid burn', { mass: 3 }),
  n('chair|stool', 52, 84, 'solid burn', { mass: 1 }),
  n('bed', 160, 64, 'solid burn bouncy soft', { mass: 3 }),
  n('sofa|couch', 160, 76, 'solid burn soft', { mass: 3 }),
  n('bench', 132, 46, 'solid burn', { mass: 2 }),
  n('trampoline', 124, 42, 'solid bouncy', { mass: 3 }),
  n('spring|pogo stick', 40, 46, 'solid bouncy', { mass: 1 }),
  n('pillow|cushion', 62, 28, 'solid soft burn warm', { mass: 0.5, color: '#9fc6f4' }),
  n('blanket|quilt|duvet', 96, 22, 'solid soft burn warm', { mass: 0.5, color: '#e8726a' }),
  n('scarf|sweater|jumper|mittens', 60, 40, 'soft burn warm', { mass: 0.5, color: '#e25a6a', art: 'scarf' }),
  n('tent', 150, 100, 'solid burn', { mass: 2 }),
  n('gift|present', 52, 52, 'solid burn', { mass: 1, color: '#6a8ce8' }),
  n('chest|treasure chest|treasure', 84, 62, 'solid', { mass: 4 }),
  n('book', 44, 32, 'solid burn', { mass: 0.5, color: '#4a8ad8' }),
  // Heavy things
  n('anvil', 84, 52, 'solid', { mass: 8 }),
  n('piano', 156, 112, 'solid burn', { mass: 8 }),
  n('safe|vault', 72, 82, 'solid', { mass: 8 }),
  n('weight|dumbbell|kettlebell', 70, 40, 'solid', { mass: 6 }),
  n('rock|stone|pebble', 52, 38, 'solid', { mass: 2 }),
  n('boulder', 112, 92, 'solid', { mass: 8 }),
  n('fridge|refrigerator|freezer', 72, 132, 'solid cold', { mass: 6 }),
  n('stove|oven|cooker', 82, 84, 'solid hot warm', { mass: 6 }),
  // Water, cold and heat
  n('bucket|pail', 46, 46, 'wet', { mass: 1 }),
  n('water|puddle|splash', 54, 36, 'wet', { mass: 1 }),
  n('fire extinguisher|extinguisher', 34, 66, 'wet cold', { mass: 1 }),
  n('hose|hosepipe|garden hose', 64, 34, 'wet', { mass: 1 }),
  n('watering can', 58, 42, 'wet', { mass: 1 }),
  n('rain cloud|raincloud|rain|storm|storm cloud', 150, 64, 'fly wet rain', { mass: 1 }),
  n('snowball|snow', 36, 36, 'cold wet', { mass: 0.5 }),
  n('snowman', 64, 112, 'solid cold', { mass: 2 }),
  n('ice|ice cube|ice block|iceberg', 62, 62, 'solid cold', { mass: 2 }),
  n('fire|flame|flames', 50, 64, 'flame hot warm light', { mass: 0.5 }),
  n('campfire|bonfire|camp fire', 84, 52, 'flame hot warm light', { mass: 2 }),
  n('torch', 22, 74, 'flame hot warm light', { mass: 0.5 }),
  n('candle', 20, 40, 'flame hot warm light', { mass: 0.5 }),
  n('heater|radiator|fireplace', 76, 64, 'solid hot warm', { mass: 3 }),
  n('sun', 96, 96, 'fly hot warm light', { mass: 2 }),
  n('lamp|floor lamp', 44, 96, 'light', { mass: 1 }),
  n('lantern', 36, 50, 'light warm', { mass: 0.5 }),
  n('flashlight', 48, 22, 'light', { mass: 0.5 }),
  n('light bulb|lightbulb|bulb|light', 28, 42, 'light', { mass: 0.5 }),
  n('star', 54, 54, 'fly light', { mass: 0.5 }),
  n('moon', 72, 72, 'fly light', { mass: 2 }),
  n('firefly|fireflies|glow worm', 22, 18, 'alive fly light', { mass: 0.5 }),
  // Blowing things up, breaking things, catching things
  n('bomb', 42, 46, 'explode', { mass: 1 }),
  n('dynamite|tnt|explosive', 44, 40, 'explode burn', { mass: 1 }),
  n('pickaxe|pick|pick axe', 64, 60, 'break', { mass: 1 }),
  n('hammer|mallet|sledgehammer', 54, 44, 'break', { mass: 1 }),
  n('drill|jackhammer', 62, 52, 'break', { mass: 2 }),
  n('shovel|spade', 32, 92, 'break', { mass: 1 }),
  n('axe', 52, 62, 'break', { mass: 1 }),
  n('saw', 74, 30, 'break', { mass: 1 }),
  n('cage', 92, 84, 'trap solid', { mass: 3 }),
  n('net|fishing net', 92, 44, 'trap', { mass: 1 }),
  // Things that fly or go
  n('balloon', 42, 104, 'fly ride hang', { mass: 0.5, color: '#ef5a6a', speed: 150 }),
  n('hot air balloon|air balloon', 130, 210, 'fly ride hang', { mass: 3, speed: 150 }),
  n('kite', 64, 76, 'fly ride hang', { mass: 0.5, color: '#f2a23a', speed: 170 }),
  n('plane|airplane|aeroplane|jet', 170, 62, 'fly ride', { mass: 5, speed: 260 }),
  n('helicopter', 156, 74, 'fly ride', { mass: 5, speed: 200 }),
  n('ufo|flying saucer|spaceship', 124, 52, 'fly ride light', { mass: 3, speed: 230 }),
  n('rocket', 54, 124, 'fly ride hot', { mass: 3, speed: 300 }),
  n('magic carpet|flying carpet', 144, 22, 'fly ride solid', { mass: 1, speed: 180 }),
  n('carpet|rug', 144, 12, 'solid burn soft', { mass: 1 }),
  n('broom|broomstick', 116, 22, 'fly ride burn', { mass: 0.5, speed: 190 }),
  n('cloud', 150, 62, 'fly ride solid soft', { mass: 1, speed: 140 }),
  n('rainbow', 260, 124, 'fly solid arc light', { mass: 1 }),
  n('car', 156, 72, 'drive solid', { mass: 6, color: '#e84a3a', speed: 260 }),
  n('truck|lorry|van', 196, 104, 'drive solid', { mass: 8, color: '#3a8ae8', speed: 220 }),
  n('bus|school bus', 226, 112, 'drive solid', { mass: 10, color: '#f2c230', speed: 200 }),
  n('tractor', 154, 104, 'drive solid', { mass: 8, speed: 150 }),
  n('bicycle|bike', 94, 62, 'drive', { mass: 1, color: '#3aa0e8', speed: 230 }),
  n('skateboard', 72, 18, 'drive solid', { mass: 0.5, speed: 280 }),
  n('wagon|cart|wheelbarrow', 104, 60, 'drive solid', { mass: 2, speed: 160 }),
  n('boat|rowboat|canoe|ship', 156, 62, 'boat float solid', { mass: 3, speed: 170 }),
  n('raft', 150, 26, 'boat float solid burn', { mass: 2, speed: 140 }),
  // Animals
  n('chinchilla|kit|chin', 56, 46, 'alive', { mass: 1, speed: 110 }),
  n('dog|puppy|hound', 84, 64, 'alive scary', { mass: 2, color: '#c98a4e', speed: 120 }),
  n('cat|kitten', 64, 52, 'alive', { mass: 1, color: '#f2a24a', speed: 100 }),
  n('mouse|rat', 32, 22, 'alive', { mass: 0.5, color: '#a8a4b0', speed: 90 }),
  n('rabbit|bunny|hare', 44, 50, 'alive jumper', { mass: 0.5, color: '#e8dcd0', speed: 110 }),
  n('horse|pony', 154, 134, 'alive ride jumper', { mass: 6, color: '#a86a3a', speed: 300 }),
  n('donkey|mule', 136, 120, 'alive ride', { mass: 5, color: '#9a9aa2', art: 'horse', speed: 200 }),
  n('unicorn', 154, 134, 'alive ride jumper light', { mass: 6, color: '#fdfbff', art: 'horse', speed: 320 }),
  n('llama|alpaca|vicuna', 92, 144, 'alive ride', { mass: 4, color: '#f3e6cf', speed: 180 }),
  n('camel', 156, 156, 'alive ride', { mass: 7, color: '#d9a866', speed: 170 }),
  n('cow|bull', 154, 104, 'alive', { mass: 7, color: '#ffffff', speed: 60 }),
  n('pig|piglet', 92, 62, 'alive', { mass: 3, color: '#f4b2b8', speed: 80 }),
  n('sheep|lamb', 92, 72, 'alive soft', { mass: 3, color: '#f7f4ee', speed: 70 }),
  n('goat', 84, 74, 'alive jumper', { mass: 2, color: '#e8e2d6', speed: 110 }),
  n('fox', 84, 54, 'alive', { mass: 1, color: '#e8743a', speed: 140 }),
  n('wolf', 106, 72, 'alive scary', { mass: 3, color: '#8d8a96', speed: 150 }),
  n('bear|grizzly', 134, 112, 'alive scary', { mass: 7, color: '#8a5a3a', speed: 90 }),
  n('polar bear', 134, 112, 'alive scary cold', { mass: 7, color: '#f4f4f0', art: 'bear', speed: 90 }),
  n('lion', 134, 94, 'alive scary', { mass: 5, color: '#e0a44a', speed: 140 }),
  n('tiger', 134, 84, 'alive scary', { mass: 5, color: '#f08a2a', speed: 150 }),
  n('puma|cougar|mountain lion|panther', 124, 72, 'alive scary', { mass: 4, color: '#d2a06a', speed: 150 }),
  n('elephant', 206, 172, 'alive ride solid', { mass: 12, color: '#a4a6b4', speed: 90 }),
  n('giraffe', 116, 262, 'alive ride', { mass: 6, color: '#f2c460', speed: 120 }),
  n('deer|reindeer', 104, 112, 'alive jumper', { mass: 3, color: '#b87c4a', speed: 160 }),
  n('turtle|tortoise', 64, 38, 'alive solid', { mass: 2, color: '#6aa84e', speed: 20 }),
  n('frog|toad', 42, 32, 'alive jumper', { mass: 0.5, color: '#6ac24e', speed: 60 }),
  n('snake', 94, 22, 'alive scary', { mass: 1, color: '#6ab84e', speed: 50 }),
  n('bee|bumblebee|wasp', 28, 24, 'alive fly scary', { mass: 0.5, speed: 90 }),
  n('butterfly|moth', 32, 26, 'alive fly', { mass: 0.5, color: '#ffa24a', speed: 60 }),
  n('bird|sparrow|robin', 40, 32, 'alive fly', { mass: 0.5, color: '#6aa6e8', speed: 110 }),
  n('owl', 52, 62, 'alive fly', { mass: 1, color: '#a8845a', speed: 90 }),
  n('eagle|hawk|falcon', 116, 62, 'alive fly ride scary', { mass: 2, color: '#7a5a3a', speed: 220, art: 'bigbird' }),
  n('condor|vulture', 134, 64, 'alive fly ride', { mass: 2, color: '#2e2a30', speed: 200, art: 'bigbird' }),
  n('parrot', 42, 62, 'alive fly', { mass: 0.5, color: '#e8403a', speed: 110 }),
  n('duck', 52, 50, 'alive float', { mass: 1, color: '#f2d23a', speed: 70 }),
  n('chicken|hen|rooster', 48, 52, 'alive', { mass: 1, color: '#ffffff', speed: 80 }),
  n('penguin', 46, 62, 'alive cold', { mass: 1, speed: 50 }),
  n('fish|salmon|trout', 52, 28, 'food meat float', { mass: 0.5, color: '#6aa6d8' }),
  n('shark', 164, 64, 'alive scary float', { mass: 5, color: '#7a8aa4', speed: 120 }),
  n('dragon', 206, 142, 'alive fly ride scary hot light', { mass: 6, color: '#4ab86a', speed: 240 }),
  n('dinosaur|t rex|t-rex|trex', 226, 184, 'alive scary', { mass: 10, color: '#6ab86a', speed: 110 }),
  n('ghost', 62, 82, 'alive fly scary ghost', { mass: 0.5, speed: 70 }),
  n('robot', 72, 112, 'alive solid', { mass: 5, speed: 70 }),
  n('zombie', 62, 112, 'alive scary', { mass: 2, speed: 40 }),
  n('monster', 124, 124, 'alive scary', { mass: 5, color: '#8a5ad8', speed: 80 }),
  n('scarecrow', 74, 136, 'scary burn', { mass: 1 }),
  n('teddy bear|teddy|stuffed animal', 52, 62, 'soft burn warm', { mass: 0.5 }),
  // Food
  n('apple', 32, 34, 'food plant', { mass: 0.5, color: '#e8403a' }),
  n('orange|tangerine|clementine', 32, 32, 'food plant', { mass: 0.5, color: '#f5921e', art: 'apple' }),
  n('lemon|lime', 34, 28, 'food plant', { mass: 0.5, color: '#f5dc3a', art: 'apple' }),
  n('banana', 48, 24, 'food plant', { mass: 0.5 }),
  n('carrot', 54, 20, 'food plant', { mass: 0.5 }),
  n('lettuce|cabbage|salad', 44, 36, 'food plant', { mass: 0.5 }),
  n('grass|clover', 44, 30, 'food plant', { mass: 0.5 }),
  n('hay bale|hay|haystack|bale|straw', 112, 66, 'food plant solid burn float', { mass: 2 }),
  n('raisin|raisins', 18, 14, 'food plant', { mass: 0.5 }),
  n('strawberry', 28, 32, 'food plant', { mass: 0.5 }),
  n('grapes|grape', 32, 42, 'food plant', { mass: 0.5 }),
  n('corn|sweetcorn|corn cob', 22, 54, 'food plant', { mass: 0.5 }),
  n('watermelon|melon', 64, 46, 'food plant', { mass: 2 }),
  n('pumpkin', 64, 52, 'food plant solid', { mass: 2 }),
  n('mushroom|toadstool', 42, 42, 'food plant', { mass: 0.5 }),
  n('flower|daisy|rose|tulip', 24, 46, 'plant', { mass: 0.5, color: '#f7a1c4' }),
  n('sunflower', 34, 126, 'plant food', { mass: 0.5 }),
  n('tree|oak', 190, 300, 'climb canopy burn', { mass: 6 }),
  n('pine tree|pine|fir|christmas tree', 130, 260, 'climb canopy burn', { mass: 5, art: 'pine' }),
  n('bush|shrub|hedge', 94, 62, 'plant burn soft', { mass: 1 }),
  n('cactus', 54, 94, 'plant', { mass: 1 }),
  n('cheese', 52, 36, 'food', { mass: 0.5 }),
  n('bread|loaf|toast', 62, 36, 'food burn', { mass: 0.5 }),
  n('cake|birthday cake', 72, 62, 'food', { mass: 1 }),
  n('cookie|biscuit', 34, 34, 'food', { mass: 0.5 }),
  n('pizza', 64, 16, 'food', { mass: 0.5 }),
  n('ice cream|icecream', 28, 54, 'food cold', { mass: 0.5 }),
  n('lollipop|candy|sweets', 22, 54, 'food', { mass: 0.5 }),
  n('pie', 62, 26, 'food hot warm', { mass: 0.5 }),
  n('sandwich', 62, 32, 'food', { mass: 0.5 }),
  n('egg', 26, 32, 'food', { mass: 0.5 }),
  n('honey|honey pot', 36, 42, 'food', { mass: 0.5 }),
  n('hot chocolate|cocoa|tea|soup|coffee', 36, 38, 'food hot warm', { mass: 0.5, art: 'mug' }),
  n('steak|meat|ham|chop', 54, 32, 'food meat', { mass: 0.5 }),
  n('sausage|hot dog|hotdog', 62, 22, 'food meat', { mass: 0.5 }),
  n('drumstick|chicken leg|turkey', 44, 40, 'food meat', { mass: 0.5 }),
  n('bone', 54, 22, 'food meat', { mass: 0.5 }),
  n('brain|brains', 46, 36, 'food meat brain', { mass: 0.5 }),
  // Toys and odds and ends
  n('ball|football|soccer ball|basketball', 42, 42, 'bouncy', { mass: 0.5 }),
  n('beach ball', 54, 54, 'bouncy float', { mass: 0.5 }),
  n('umbrella|parasol', 84, 94, 'burn', { mass: 0.5, color: '#e8403a' }),
  n('lighthouse', 80, 250, 'solid light', { mass: 8 }),
];

export type Adjective = {
  id: string; words: string[];
  /** Multiplies width and height (and mass by the area). */
  scale?: number; sw?: number; sh?: number;
  add?: Tag[]; remove?: Tag[]; mass?: number; massMul?: number; speed?: number;
  tint?: string; pattern?: 'stripes' | 'spots' | 'rainbow';
  mood?: 'angry' | 'friendly' | 'sleepy' | 'hungry' | 'happy';
  look?: 'golden' | 'metal' | 'wooden' | 'stone' | 'frozen' | 'glowing' | 'ghostly' | 'fluffy';
};
const a = (words: string, o: Omit<Adjective, 'id' | 'words'>): Adjective => { const list = words.split('|'); return { id: list[0], words: list, ...o }; };

export const ADJECTIVES: Adjective[] = [
  a('giant|huge|enormous|massive|gigantic', { scale: 2 }),
  a('big|large', { scale: 1.5 }),
  a('tiny|mini|little|small|teeny', { scale: 0.5 }),
  a('long', { sw: 2 }),
  a('tall', { sh: 2 }),
  a('short', { sh: 0.6 }),
  a('flying|winged|flappy', { add: ['fly', 'ride'] }),
  a('fast|speedy|quick|turbo', { speed: 1.8 }),
  a('slow|lazy', { speed: 0.5 }),
  a('bouncy|springy|jumpy', { add: ['bouncy'] }),
  a('rubber|jelly', { add: ['bouncy'], remove: ['burn'], tint: '#e86a9a' }),
  a('heavy|weighty', { mass: 6 }),
  a('light|floaty|lightweight', { massMul: 0.2, add: ['float'] }),
  a('floating|buoyant|inflatable', { add: ['float'] }),
  a('flaming|burning|fiery|blazing', { add: ['flame', 'hot', 'warm', 'light'] }),
  a('hot|warm|heated|toasty', { add: ['hot', 'warm'] }),
  a('frozen|icy|cold|chilly|freezing|snowy', { add: ['cold'], remove: ['hot', 'warm', 'flame'], look: 'frozen' }),
  a('wet|soggy|soaking', { add: ['wet'] }),
  a('golden|gold', { massMul: 2, look: 'golden' }),
  a('wooden|wood', { add: ['burn', 'float'], look: 'wooden' }),
  a('metal|iron|steel|robotic', { mass: 4, remove: ['burn', 'float'], look: 'metal' }),
  a('stone|rocky|concrete', { mass: 5, remove: ['burn', 'float'], look: 'stone' }),
  a('glowing|shiny|sparkly|magic|magical|glittery', { add: ['light'], look: 'glowing' }),
  a('angry|mean|grumpy|evil|hostile', { mood: 'angry' }),
  a('friendly|kind|nice|tame', { mood: 'friendly', remove: ['scary'] }),
  a('happy|smiling|cheerful', { mood: 'happy' }),
  a('sleepy|tired|sleeping', { mood: 'sleepy' }),
  a('hungry|starving', { mood: 'hungry' }),
  a('scary|spooky|creepy|terrifying|fierce', { add: ['scary'] }),
  a('explosive|exploding|dangerous', { add: ['explode'] }),
  a('sticky|glue|magnetic', { add: ['sticky'] }),
  a('ghostly|ghost|transparent', { add: ['scary', 'float'], look: 'ghostly' }),
  a('fluffy|soft|furry|woolly', { add: ['soft', 'warm'], look: 'fluffy' }),
  a('red', { tint: '#e8403a' }),
  a('orange', { tint: '#f5921e' }),
  a('yellow', { tint: '#f5d23a' }),
  a('green', { tint: '#4ab85a' }),
  a('blue', { tint: '#3a8ae8' }),
  a('purple|violet', { tint: '#9a5ae0' }),
  a('pink', { tint: '#f59ac0' }),
  a('black|dark', { tint: '#3a3642' }),
  a('white', { tint: '#f7f6f2' }),
  a('brown', { tint: '#8a5a3a' }),
  a('grey|gray|silver', { tint: '#a4a6b0' }),
  a('rainbow|colourful|colorful', { pattern: 'rainbow' }),
  a('striped|stripy', { pattern: 'stripes' }),
  a('spotty|spotted|dotty', { pattern: 'spots' }),
];

const NOUN_BY_WORD = new Map<string, Noun>();
for (const x of NOUNS) for (const w of x.words) if (!NOUN_BY_WORD.has(w)) NOUN_BY_WORD.set(w, x);
const ADJ_BY_WORD = new Map<string, Adjective>();
for (const x of ADJECTIVES) for (const w of x.words) if (!ADJ_BY_WORD.has(w)) ADJ_BY_WORD.set(w, x);
export const NOUN = new Map(NOUNS.map((x) => [x.id, x]));
export const ADJ = new Map(ADJECTIVES.map((x) => [x.id, x]));

const STOP = new Set(['a', 'an', 'the', 'some', 'very', 'really', 'super', 'extra', 'of', 'and', 'with', 'my', 'one']);
const HEROES = new Set(['dora', 'enzo']);
const RESERVED = new Set(['wolfberry', 'golden wolfberry', 'starite', 'star fruit']);

/** A plural or a British/US spelling back to the dictionary word, when there is one. */
function nounFor(phrase: string): Noun | undefined {
  const hit = NOUN_BY_WORD.get(phrase);
  if (hit) return hit;
  if (phrase.endsWith('ies')) return NOUN_BY_WORD.get(phrase.slice(0, -3) + 'y');
  if (phrase.endsWith('ves')) return NOUN_BY_WORD.get(phrase.slice(0, -3) + 'f') ?? NOUN_BY_WORD.get(phrase.slice(0, -3) + 'fe');
  if (phrase.endsWith('es') && NOUN_BY_WORD.get(phrase.slice(0, -2))) return NOUN_BY_WORD.get(phrase.slice(0, -2));
  if (phrase.endsWith('s')) return NOUN_BY_WORD.get(phrase.slice(0, -1));
  return undefined;
}

function distance(x: string, y: string) {
  const d = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const keep = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (x[i - 1] === y[j - 1] ? 0 : 1));
      prev = keep;
    }
  }
  return d[y.length];
}
/** The closest dictionary word, for "did you mean". */
export function suggest(word: string, kind: 'noun' | 'adjective' | 'any' = 'any'): string | null {
  let best: string | null = null, bestD = (word.length <= 3 ? 1 : 2) + 1;
  const pools = kind === 'noun' ? [NOUN_BY_WORD] : kind === 'adjective' ? [ADJ_BY_WORD] : [NOUN_BY_WORD, ADJ_BY_WORD];
  for (const pool of pools) for (const w of pool.keys()) {
    const dd = distance(word, w);
    if (dd < bestD) { best = w; bestD = dd; }
  }
  return best;
}

export type Parsed =
  | { ok: true; noun: Noun; adjs: Adjective[]; words: string[] }
  | { ok: false; reason: 'empty' | 'unknown' | 'no-noun' | 'reserved' | 'hero'; word?: string; suggestion?: string | null };

/** "A GIANT flying hay-bale!" → the hay bale noun with giant and flying. The noun comes last. */
export function parse(text: string): Parsed {
  const clean = text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z\s-]/g, ' ').replace(/-/g, ' ').trim();
  const tokens = clean.split(/\s+/).filter((t) => t && !STOP.has(t));
  if (!tokens.length) return { ok: false, reason: 'empty' };
  const joined = tokens.join(' ');
  if ([...RESERVED].some((r) => joined.endsWith(r))) return { ok: false, reason: 'reserved' };
  if (HEROES.has(tokens[tokens.length - 1])) return { ok: false, reason: 'hero', word: tokens[tokens.length - 1] };
  let noun: Noun | undefined, used = 0;
  for (let k = Math.min(3, tokens.length); k >= 1 && !noun; k--) {
    noun = nounFor(tokens.slice(tokens.length - k).join(' '));
    if (noun) used = k;
  }
  if (!noun) {
    const last = tokens[tokens.length - 1];
    if (ADJ_BY_WORD.has(last)) return { ok: false, reason: 'no-noun', word: last };
    return { ok: false, reason: 'unknown', word: last, suggestion: suggest(last, 'noun') };
  }
  const adjs: Adjective[] = [];
  for (const t of tokens.slice(0, tokens.length - used)) {
    const adj = ADJ_BY_WORD.get(t);
    if (!adj) {
      // "hay bale" typed as "bale hay" and the like still has to name one noun; everything before it describes it.
      return { ok: false, reason: 'unknown', word: t, suggestion: suggest(t, 'adjective') };
    }
    if (!adjs.includes(adj)) adjs.push(adj);
  }
  return { ok: true, noun, adjs, words: [...adjs.map((x) => x.id), noun.id] };
}
