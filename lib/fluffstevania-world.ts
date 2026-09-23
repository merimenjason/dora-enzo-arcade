// The castle of Fluffstevania: rooms laid out on one map grid, the story lines and every item.
// Each map cell is one screen of 24×14 tiles. A room covers a rectangle of cells, and its tiles sit at fixed
// world coordinates, so walking off one room's edge simply lands in the room next door.

export const COLS = 24, ROWS = 14, TILE = 16;
export type AreaId = 'approach' | 'hall' | 'cellar' | 'belfry' | 'catacombs';
export const AREAS: Record<AreaId, { name: string; color: string }> = {
  approach: { name: 'Moonlit Approach', color: '#6f8fd8' },
  hall: { name: 'Entrance Hall', color: '#b07fd8' },
  cellar: { name: 'Hay Cellar', color: '#d8a86f' },
  belfry: { name: 'Owl Belfry', color: '#7fd8b8' },
  catacombs: { name: 'Pantry Catacombs', color: '#9fd878' },
};

/**
 * Tiles: `#` wall, `=` ledge you can jump up through, `^` spikes, `%` a cracked wall that breaks when hit,
 * `G` a boss gate (shut during the fight), `D` a sealed door (open once the room's `opens` flag is set). Things
 * placed on the map: `S` dust-bath shrine (saves and heals), `$` Pip's shop, `i` candle, `n` sign, `H` Wolfberry
 * Leaf (max HP up), `R` relic, `I` item, `O` boss, and enemies `b` bat, `m` dust moth, `k` shell beetle,
 * `x` bone mouse, `a` armadillo guard, `r` pantry rat, `g` jar ghost, `p` cellar spider.
 */
export type Room = {
  id: string; area: AreaId; mx: number; my: number; w: number; h: number; rows: string[];
  notes?: string[]; items?: string[]; relic?: RelicId; boss?: BossId; opens?: string;
};
export type RelicId = 'dash' | 'hop';
export type BossId = 'owl' | 'rat';

type Pen = {
  fill: (c0: number, r0: number, c1: number, r1: number, ch?: string) => void;
  put: (c: number, r: number, s: string) => void;
  /** Wall all four edges; openings are carved afterwards with `fill(..., '.')`. */
  box: () => void;
};
function room(id: string, area: AreaId, mx: number, my: number, w: number, h: number, draw: (p: Pen) => void, extra: Partial<Room> = {}): Room {
  const W = w * COLS, H = h * ROWS, g = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const fill = (c0: number, r0: number, c1: number, r1: number, ch = '#') => {
    for (let r = Math.max(0, r0); r <= Math.min(H - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(W - 1, c1); c++) g[r][c] = ch;
  };
  const put = (c: number, r: number, s: string) => { for (let i = 0; i < s.length; i++) if (c + i < W && r < H) g[r][c + i] = s[i]; };
  const box = () => { fill(0, 0, W - 1, 0); fill(0, H - 1, W - 1, H - 1); fill(0, 0, 0, H - 1); fill(W - 1, 0, W - 1, H - 1); };
  draw({ fill, put, box });
  return { id, area, mx, my, w, h, rows: g.map((r) => r.join('')), ...extra };
}

/** Doors on a left or right edge are three tiles tall with the floor at row 12 of that screen. */
export const ROOMS: Room[] = [
  room('path', 'approach', 0, 2, 2, 1, (p) => {
    p.fill(0, 12, 47, 13);
    p.fill(0, 4, 0, 11);
    p.fill(12, 11, 13, 11); p.fill(26, 10, 28, 11);
    p.put(30, 8, '=====');
    p.put(3, 11, 'n'); p.put(20, 9, 'i'); p.put(32, 7, 'i'); p.put(40, 10, 'i');
    p.put(18, 11, 'k'); p.put(41, 6, 'm');
  }, { notes: ['FLUFFSTEVANIA. Visitors welcome. Snacks especially welcome. — The Management'] }),

  room('gate', 'approach', 2, 2, 1, 1, (p) => {
    p.fill(0, 12, 23, 13);
    p.fill(16, 0, 23, 8);
    p.put(6, 8, 'i'); p.put(12, 8, 'i'); p.put(9, 4, 'b');
  }),

  room('hall', 'hall', 3, 1, 3, 2, (p) => {
    p.box(); p.fill(0, 0, 71, 1); p.fill(0, 26, 71, 27); p.fill(0, 0, 1, 27); p.fill(70, 0, 71, 27);
    p.fill(0, 23, 1, 25, '.');          // lower left, from the gate
    p.fill(70, 23, 71, 25, '.');        // lower right, to the first shrine
    p.fill(70, 8, 71, 10, '.');         // upper right, to the belfry stair
    p.fill(34, 26, 37, 27, '.');        // a hole down into the cellar shaft
    // The staircase of ledges up to the gallery.
    p.put(17, 22, '========'); p.put(27, 18, '====='); p.put(34, 14, '=====');
    // The gallery: a stone walkway broken by a gap too wide to jump. Only a Dust Dash crosses it.
    p.fill(40, 11, 49, 12); p.fill(59, 11, 69, 12);
    // A hidden alcove on the left: the cracked wall hides a Wolfberry Leaf.
    p.put(12, 18, '===='); p.put(8, 14, '===='); p.fill(2, 11, 10, 11); p.fill(2, 7, 5, 7); p.fill(5, 8, 5, 10, '%'); p.put(3, 10, 'H');
    p.put(12, 21, 'i'); p.put(40, 21, 'i'); p.put(62, 21, 'i'); p.put(45, 8, 'i'); p.put(66, 8, 'i'); p.put(24, 12, 'i');
    p.put(30, 25, 'x'); p.put(55, 25, 'a'); p.put(20, 3, 'b'); p.put(46, 16, 'b'); p.put(62, 5, 'm');
  }),

  room('save-hall', 'hall', 6, 2, 1, 1, (p) => {
    p.box(); p.fill(0, 0, 23, 4); p.fill(16, 0, 23, 13); p.fill(0, 12, 23, 13);
    p.fill(0, 9, 0, 11, '.');
    p.put(8, 11, 'S'); p.put(4, 8, 'i'); p.put(12, 8, 'i');
  }),

  room('shaft', 'cellar', 4, 3, 1, 2, (p) => {
    p.box(); p.fill(0, 0, 3, 27); p.fill(20, 0, 23, 27); p.fill(0, 26, 23, 27);
    p.fill(10, 0, 13, 0, '.');          // up into the hall
    p.fill(0, 23, 3, 25, '.');          // lower left, to the cellar
    p.fill(21, 23, 23, 25, '.'); p.fill(20, 23, 20, 25, '%');   // a cracked wall to a secret room
    p.put(13, 2, '===='); p.put(6, 6, '====='); p.put(12, 10, '====='); p.put(5, 14, '====='); p.put(12, 18, '====='); p.put(6, 22, '====');
    p.put(17, 12, 'i'); p.put(7, 20, 'i'); p.put(17, 5, 'b'); p.put(5, 15, 'b'); p.put(12, 20, 'm');
  }),

  room('cellar', 'cellar', 1, 4, 3, 1, (p) => {
    p.box(); p.fill(0, 0, 71, 1); p.fill(0, 12, 71, 13);
    p.fill(0, 9, 0, 11, '.'); p.fill(71, 9, 71, 11, '.');
    p.fill(60, 10, 62, 11); p.fill(45, 12, 48, 12, '^'); p.fill(28, 10, 33, 11); p.fill(30, 8, 31, 9);
    p.put(50, 8, '======'); p.put(52, 7, 'I'); p.put(18, 8, '=====');
    p.put(8, 8, 'i'); p.put(20, 6, 'i'); p.put(38, 7, 'i'); p.put(66, 8, 'i');
    p.put(40, 11, 'x'); p.put(24, 11, 'k'); p.put(14, 11, 'a'); p.put(55, 3, 'b'); p.put(10, 4, 'm');
  }, { items: ['cake'] }),

  room('relic', 'cellar', 0, 4, 1, 1, (p) => {
    p.box(); p.fill(23, 9, 23, 11, '.'); p.fill(0, 12, 23, 13);
    p.fill(10, 11, 13, 11); p.put(11, 10, 'R');
    p.put(6, 7, 'i'); p.put(17, 7, 'i');
  }, { relic: 'dash' }),

  room('secret', 'cellar', 5, 4, 1, 1, (p) => {
    p.box(); p.fill(0, 12, 23, 13); p.fill(0, 0, 23, 5); p.fill(19, 0, 23, 13);
    p.fill(0, 9, 0, 11, '.');
    p.put(9, 11, 'I'); p.put(14, 11, 'I'); p.put(11, 8, 'i');
  }, { items: ['acorn', 'sabre'] }),

  room('stair', 'belfry', 6, 0, 1, 2, (p) => {
    p.box(); p.fill(0, 25, 23, 27); p.fill(0, 0, 23, 1);
    p.fill(0, 22, 0, 24, '.');          // from the hall gallery
    p.fill(23, 9, 23, 11, '.');         // up to the second shrine
    p.fill(16, 12, 23, 12);
    p.put(11, 21, '====='); p.put(5, 17, '====='); p.put(11, 13, '====');
    p.put(4, 5, '===='); p.put(18, 20, 'i'); p.put(3, 14, 'i'); p.put(19, 9, 'i');
    p.put(8, 3, 'b'); p.put(15, 16, 'm'); p.put(20, 24, 'k');
  }),

  room('save-belfry', 'belfry', 7, 0, 1, 1, (p) => {
    p.box(); p.fill(0, 12, 23, 13); p.fill(0, 0, 23, 4);
    p.fill(0, 9, 0, 11, '.'); p.fill(23, 9, 23, 11, '.');
    p.put(11, 11, 'S'); p.put(6, 8, 'i'); p.put(17, 8, 'i');
  }, { notes: [] }),

  room('belfry', 'belfry', 8, 0, 1, 1, (p) => {
    p.box(); p.fill(0, 12, 23, 13);
    p.fill(0, 9, 0, 11, '.'); p.fill(23, 9, 23, 11, '.');
    p.fill(1, 9, 1, 11, 'G'); p.fill(22, 9, 22, 11, 'G');
    p.put(4, 8, '====='); p.put(15, 8, '=====');
    p.put(12, 4, 'O');
  }, { boss: 'owl' }),

  room('sealed', 'belfry', 9, 0, 1, 1, (p) => {
    p.box(); p.fill(0, 12, 23, 13); p.fill(0, 0, 23, 3);
    p.fill(0, 9, 0, 11, '.'); p.fill(23, 9, 23, 11, '.');
    p.fill(17, 6, 20, 11, 'D');
    p.put(13, 11, 'n'); p.put(8, 8, 'i');
  }, { opens: 'boss:owl', notes: ['A great door crusted with old dust, sealed by Duke Hootsworth of the belfry. Beyond it lie the Pantry Catacombs.'] }),

  // ─── Chapter II: the Pantry Catacombs ─────────────────────────────────────
  room('crypt-stair', 'catacombs', 10, 0, 1, 3, (p) => {
    p.box(); p.fill(0, 0, 23, 3);
    p.fill(0, 4, 1, 41); p.fill(22, 4, 23, 41);
    p.fill(0, 9, 1, 11, '.');           // in from the sealed door
    p.fill(0, 12, 8, 13);               // the landing
    p.fill(22, 37, 23, 39, '.');        // down at the bottom, out to the ossuary
    p.put(10, 16, '======'); p.put(5, 20, '======'); p.put(10, 24, '======'); p.put(5, 28, '======'); p.put(11, 32, '======'); p.put(6, 36, '======');
    p.put(5, 9, 'i'); p.put(18, 14, 'i'); p.put(3, 26, 'i'); p.put(19, 34, 'i');
    p.put(17, 5, 'p'); p.put(8, 22, 'p'); p.put(15, 19, 'b'); p.put(14, 29, 'g');
  }),

  room('ossuary', 'catacombs', 11, 2, 3, 1, (p) => {
    p.box(); p.fill(0, 0, 71, 1); p.fill(0, 12, 71, 13);
    p.fill(0, 9, 0, 11, '.'); p.fill(71, 9, 71, 11, '.');
    p.fill(30, 12, 33, 13, '.');        // a hole down into the larder
    p.fill(14, 10, 17, 11); p.fill(44, 10, 47, 11); p.fill(56, 12, 58, 12, '^');
    p.put(22, 8, '====='); p.put(38, 8, '=====');
    // A Wolfberry Leaf on a ledge too high for one jump.
    p.put(50, 4, '====='); p.put(52, 3, 'H');
    p.put(6, 8, 'i'); p.put(24, 6, 'i'); p.put(40, 6, 'i'); p.put(60, 8, 'i'); p.put(66, 5, 'i');
    p.put(9, 11, 'r'); p.put(40, 11, 'r'); p.put(64, 11, 'r'); p.put(26, 5, 'g'); p.put(55, 7, 'g'); p.put(20, 11, 'x');
  }),

  room('save-crypt', 'catacombs', 14, 2, 1, 1, (p) => {
    p.box(); p.fill(0, 12, 23, 13);
    p.fill(0, 9, 0, 11, '.');
    p.fill(9, 0, 14, 1, '.');           // up the chimney
    p.put(9, 5, '======');              // seven tiles up: only a Cloud Hop reaches it
    p.put(10, 1, '====');
    p.put(5, 11, 'S'); p.put(18, 11, '$'); p.put(3, 8, 'i'); p.put(21, 8, 'i');
  }),

  room('chimney', 'catacombs', 14, 0, 1, 2, (p) => {
    p.box(); p.fill(0, 0, 23, 3);
    p.fill(0, 4, 3, 27); p.fill(20, 4, 23, 27);
    p.fill(9, 27, 14, 27, '.');         // down to the shrine
    p.fill(20, 9, 23, 11, '.');         // out to the throne room
    p.fill(16, 12, 23, 13);             // the top landing
    p.put(6, 25, '======'); p.put(11, 21, '======'); p.put(5, 17, '======'); p.put(11, 13, '=====');
    p.put(17, 23, 'i'); p.put(6, 15, 'i'); p.put(15, 7, 'b'); p.put(8, 10, 'b');
  }),

  room('throne', 'catacombs', 15, 0, 2, 1, (p) => {
    p.box(); p.fill(0, 12, 47, 13); p.fill(0, 0, 47, 2);
    p.fill(0, 9, 0, 11, '.'); p.fill(47, 9, 47, 11, '.');
    p.fill(1, 9, 1, 11, 'G'); p.fill(46, 9, 46, 11, 'G');
    p.put(8, 8, '====='); p.put(35, 8, '====='); p.put(21, 5, '======');
    p.put(24, 4, 'O');
  }, { boss: 'rat' }),

  room('library', 'catacombs', 17, 0, 1, 1, (p) => {
    p.box(); p.fill(0, 12, 23, 13); p.fill(0, 0, 23, 3);
    p.fill(0, 9, 0, 11, '.');
    p.fill(17, 6, 20, 11, 'D');
    p.put(13, 11, 'n'); p.put(8, 8, 'i');
  }, { notes: ['COUNT CULPEO’S LIBRARY. No crumbs. No chinchillas. The door is locked from the other side, and this chapter of Fluffstevania is still being written. Check back soon!'] }),

  room('larder', 'catacombs', 11, 3, 3, 1, (p) => {
    p.box(); p.fill(0, 0, 71, 1); p.fill(0, 12, 71, 13);
    p.fill(30, 0, 33, 1, '.'); p.put(32, 1, '==');   // the hole from the ossuary
    p.fill(0, 9, 0, 11, '.'); p.fill(71, 9, 71, 11, '.');
    p.put(27, 9, '====='); p.put(31, 5, '=====');
    p.put(8, 8, '======'); p.put(46, 8, '======'); p.put(53, 5, '=====');
    p.fill(38, 12, 41, 12, '^');
    p.put(55, 4, 'I');
    p.put(4, 8, 'i'); p.put(22, 7, 'i'); p.put(44, 6, 'i'); p.put(66, 8, 'i');
    p.put(12, 2, 'p'); p.put(40, 2, 'p'); p.put(62, 2, 'p'); p.put(20, 11, 'r'); p.put(50, 11, 'r'); p.put(36, 6, 'g'); p.put(64, 11, 'x');
  }, { items: ['pin'] }),

  room('hop-vault', 'catacombs', 10, 3, 1, 1, (p) => {
    p.box(); p.fill(0, 12, 23, 13); p.fill(0, 0, 23, 2);
    p.fill(23, 9, 23, 11, '.');
    p.fill(8, 12, 16, 12, '^');         // a spike trench only a dash clears
    p.fill(2, 11, 5, 11); p.put(3, 10, 'R');
    p.put(6, 7, 'i'); p.put(19, 7, 'i');
  }, { relic: 'hop' }),

  room('jam-vault', 'catacombs', 14, 3, 1, 1, (p) => {
    p.box(); p.fill(0, 12, 23, 13);
    p.fill(0, 9, 0, 11, '.');
    p.put(3, 9, '====');                // one ordinary jump up…
    p.put(8, 3, '=========');           // …then six more tiles: only a Cloud Hop gets there
    p.put(10, 2, 'I'); p.put(14, 2, 'H');
    p.put(20, 8, 'i'); p.put(5, 5, 'i'); p.put(18, 6, 'g'); p.put(12, 7, 'p');
  }, { items: ['wolfblade'] }),
];

export const START = { room: 'path', x: 5 * TILE, y: (2 * ROWS + 12) * TILE };

// ─── Gear, items and relics ───────────────────────────────────────────────

export type HeroId = 'dora' | 'enzo';
export type Slot = 'weapon' | 'armor' | 'acc';
export type WeaponStyle = 'rapier' | 'claws' | 'club';
export type Gear = { name: string; slot: Slot; hero?: HeroId; style?: WeaponStyle; atk?: number; def?: number; lck?: number; reach?: number; text: string };
export const GEAR: Record<string, Gear> = {
  rapier: { name: 'Dust Rapier', slot: 'weapon', hero: 'dora', style: 'rapier', atk: 3, text: 'A slim blade Dora thrusts fast and far.' },
  sabre: { name: 'Moonlit Sabre', slot: 'weapon', hero: 'dora', style: 'rapier', atk: 8, reach: 6, text: 'A silver sabre that glints like the moon. Longer and sharper.' },
  wolfblade: { name: 'Wolfberry Blade', slot: 'weapon', hero: 'dora', style: 'rapier', atk: 15, reach: 10, text: 'A crimson blade with a golden berry set in the hilt. The finest sword in the castle.' },
  claws: { name: 'Scrappy Claws', slot: 'weapon', hero: 'enzo', style: 'claws', atk: 2, text: 'Enzo’s own two paws. He lunges in with quick swipes.' },
  ironclaws: { name: 'Iron Claws', slot: 'weapon', hero: 'enzo', style: 'claws', atk: 10, reach: 4, text: 'Pip’s finest paw guards. Quick lunging swipes that really sting.' },
  acorn: { name: 'Acorn Cudgel', slot: 'weapon', hero: 'enzo', style: 'club', atk: 9, text: 'A hard acorn on a stick. Slow, heavy swings.' },
  pin: { name: 'Rolling Pin', slot: 'weapon', hero: 'enzo', style: 'club', atk: 16, reach: 4, text: 'A marble rolling pin from the larder. Heavy, and very flattening.' },
  scarf: { name: 'Wool Scarf', slot: 'armor', def: 2, text: 'Knitted by Grandpa Pebble. Warm and a little protective.' },
  cape: { name: 'Moth Cape', slot: 'armor', def: 5, text: 'Dusty moth wings stitched into a cape.' },
  helm: { name: 'Thimble Helm', slot: 'armor', def: 8, text: 'A silver thimble worn as a helmet. Surprisingly sturdy.' },
  bell: { name: 'Silver Bell', slot: 'acc', lck: 8, text: 'Jingles when luck is near. More drops and critical hits.' },
  shell: { name: 'Beetle Shell', slot: 'acc', def: 3, text: 'A polished shell worn as a shield charm.' },
  ring: { name: 'Raisin Ring', slot: 'acc', def: 2, lck: 6, text: 'A dried raisin set in brass. Lucky, and a little chewy.' },
};
/** Gear from older saves that has since been replaced. */
export const RENAMED: Record<string, string> = { ribbon: 'rapier', bramble: 'sabre' };
export const FOOD: Record<string, { name: string; heal: number; text: string }> = {
  cake: { name: 'Hay Cake', heal: 40, text: 'Pressed hay and a raisin on top. Heals 40 HP.' },
  berry: { name: 'Wolfberry', heal: 20, text: 'An ordinary red wolfberry. Heals 20 HP.' },
  tea: { name: 'Timothy Tea', heal: 80, text: 'A flask of warm hay tea. Heals 80 HP.' },
};
export const RELICS: Record<RelicId, { name: string; text: string }> = {
  dash: { name: 'Dust Dash', text: 'Burst forward in a puff of dust, even once in mid-air. Dash then jump to leap far.' },
  hop: { name: 'Cloud Hop', text: 'Jump once more in mid-air, off a puff of dust.' },
};
/** Pip's stall in the catacombs. `seeds` is a bundle of ten sunflower seeds. */
export const SHOP: { id: string; price: number }[] = [
  { id: 'berry', price: 8 }, { id: 'cake', price: 24 }, { id: 'tea', price: 45 }, { id: 'seeds', price: 12 },
  { id: 'helm', price: 90 }, { id: 'ring', price: 130 }, { id: 'ironclaws', price: 160 },
];
export const itemName = (id: string) => (id === 'seeds' ? 'Sunflower Seeds ×10' : GEAR[id]?.name ?? FOOD[id]?.name ?? id);

// ─── Story ────────────────────────────────────────────────────────────────

export type Speaker = HeroId | 'owl' | 'rat' | 'pip' | 'sign';
export type Line = { who: Speaker; text: string };
export const SCRIPTS: Record<string, Line[]> = {
  intro: [
    { who: 'enzo', text: 'There it is. Fluffstevania. Grandpa Pebble says the Golden Wolfberry grows at the very top.' },
    { who: 'dora', text: 'One berry that never runs out. Unlimited snacks, Enzo. Un-lim-i-ted.' },
    { who: 'enzo', text: 'He also says nobody who went in for it ever came back out.' },
    { who: 'dora', text: 'Nobody who went in had you with them. Stay close. If I get in trouble, tag in!' },
  ],
  hall: [
    { who: 'dora', text: 'The candles are still lit. Somebody lives here.' },
    { who: 'enzo', text: 'Somebody who really likes cobwebs. And bats. Why is it always bats?' },
    { who: 'dora', text: 'That gallery up there leads higher, but the walkway is broken. That gap is too wide to jump.' },
  ],
  cellar: [
    { who: 'enzo', text: 'Hay bales, barrels, cake crumbs... it’s a pantry! A creepy pantry, but still.' },
    { who: 'dora', text: 'Focus. Snack later. Something down here is glowing.' },
  ],
  dash: [
    { who: 'sign', text: 'You found the Dust Dash! Press Shift (or L) to burst forward. It works once in mid-air too, and dashing into a jump sends you flying.' },
    { who: 'dora', text: 'Now that broken gallery in the hall doesn’t look so wide.' },
  ],
  owl: [
    { who: 'owl', text: 'Hoo? Two chinchillas in MY belfry? The Golden Wolfberry belongs to Count Culpeo, little snacks.' },
    { who: 'enzo', text: 'Did he just call us snacks?' },
    { who: 'dora', text: 'He called us LITTLE snacks. Get him!' },
  ],
  owlDown: [
    { who: 'owl', text: 'Hoo... hooo... Go on then. The door to the catacombs is open. The Count waits beyond, and he is always, always hungry.' },
    { who: 'dora', text: 'Then we’ll bring our own snacks.' },
    { who: 'enzo', text: 'I’ll carry them. For safety.' },
  ],
  crypt: [
    { who: 'enzo', text: 'It smells like old cheese and older bones down here.' },
    { who: 'dora', text: 'The Pantry Catacombs. A castle this hungry has to keep its snacks somewhere. Keep your nose sharp.' },
  ],
  pip: [
    { who: 'pip', text: 'Customers! Real live ones! I’m Pip. I sell snacks and shiny things for raisins. Step up to my stall and press up.' },
    { who: 'enzo', text: 'A hamster. Running a shop. In a crypt.' },
    { who: 'pip', text: 'The rent is very cheap down here.' },
  ],
  larder: [
    { who: 'dora', text: 'Jars as far as I can see. Pickles, jam, honey... and something moving between the shelves.' },
    { who: 'enzo', text: 'Don’t say that when I’m standing under the shelves.' },
  ],
  hop: [
    { who: 'sign', text: 'You found the Cloud Hop! Press jump again in mid-air to hop off a puff of dust.' },
    { who: 'enzo', text: 'That ledge up in Pip’s shrine room. We can reach it now.' },
  ],
  rat: [
    { who: 'rat', text: 'Chinchillas?! In MY pantry? Every crumb down here belongs to Gnawdrick, King of the Rats!' },
    { who: 'dora', text: 'We only want to pass through.' },
    { who: 'rat', text: 'Nobody passes through. Everybody gets NIBBLED.' },
    { who: 'enzo', text: 'Okay. Now I’m offended.' },
  ],
  ratDown: [
    { who: 'rat', text: 'My cheese... my throne... Fine! Go on to the Count’s library. He’ll swallow you in one bite.' },
    { who: 'enzo', text: 'Why does everyone in this castle want to eat us?' },
    { who: 'dora', text: 'Because we’re adorable. And the Golden Wolfberry is getting closer. Come on.' },
  ],
};
/** Scripts that play the first time the heroes enter a room. */
export const ROOM_SCRIPTS: Record<string, string> = { path: 'intro', hall: 'hall', cellar: 'cellar', 'crypt-stair': 'crypt', 'save-crypt': 'pip', larder: 'larder' };
