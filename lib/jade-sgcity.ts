// Jade Street: the Singapore pass over the finished city (it runs after the build, the remodel and the dressing, so it
// never shifts the build's random draws: cats, hides and murals stay where they were). It lays out the hawker centre
// on Smith Street (four food stalls, Uncle Teo's kopi stall, the tables people chope with tissue packets), the wet
// market, Uncle Teo's kopitiam, the HDB block with its void deck (Uncle Goh's chess table and the mama shop), the
// getai stage in the docks car park, bumboat jetties on the river, road-toll gantries, the five-foot ways (the shaded
// arcade in front of every shophouse), the pigeons' squares, the litter bins and the karang guni man's round.
// Pure data; lib/jade-sg.ts runs it and lib/jade-scene.ts paints it.
import { T, W, H, G, S, districtAt, type City, type Prop } from './jade-city.js';

export type Gantry = { x: number; y: number; axis: 'h' | 'v'; tx: number; ty: number };
export type SgCity = {
  /** tiles of shaded five-foot way (1) in front of the shophouses */
  fivefoot: Uint8Array;
  /** the hawker centre's floor, its tables (index = chope slot), the kopi counter */
  hawker: { x0: number; y0: number; x1: number; y1: number }; tables: { x: number; y: number }[]; kopi: [number, number];
  gantries: Gantry[];
  /** where the pigeons gather, the litter bins, chewing-gum finds, the karang guni man's round and junk spots */
  pigeons: [number, number][]; bins: [number, number][]; gum: [number, number][]; round: [number, number][]; junk: [number, number][];
  /** the void deck chess table, the mama shop counter, the getai stage, the bumboat jetties */
  chess: [number, number]; mama: [number, number]; getai: [number, number]; jetties: [number, number][];
  /** the silver zone (slow down for the old folk): tile rects */
  silver: [number, number, number, number][];
};
const px = (t: number) => t * T + T / 2;

export function sgCity(c: City) {
  const at = (x: number, y: number) => y * W + x;
  const setT = (x: number, y: number, g: number, s: number) => { const i = at(x, y); c.ground[i] = g; c.solid[i] = s; c.flags[i] = 0; };
  const clearBld = (x0: number, y0: number, x1: number, y1: number) => { c.buildings = c.buildings.filter(b => b.x + b.w <= x0 || b.x > x1 || b.y + b.h <= y0 || b.y > y1); };
  const dropProps = (x0: number, y0: number, x1: number, y1: number, keep?: (p: Prop) => boolean) => {
    const inR = (p: Prop) => { const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T); return tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1; };
    c.props = c.props.filter(p => !inR(p) || (keep?.(p) ?? false));
  };
  const prop = (x: number, y: number, sprite: string, r: number, solid: Prop['solid'], layer: Prop['layer'] = 'over', w?: number) => {
    if (solid === 'low') c.solid[at(x, y)] = S.LOW;
    c.props.push({ x: px(x), y: px(y), sprite, r, solid, layer, w });
  };
  const place = (name: string, x: number, y: number, kind: string, label?: string) => { c.places[name] = { x: px(x), y: px(y), d: districtAt(x, y), kind, name: label }; };

  // ── the hawker centre (Smith Street, south): the shophouse block opens into one big covered food hall
  clearBld(14, 67, 25, 75); dropProps(14, 67, 25, 75);
  for (let y = 67; y <= 75; y++) for (let x = 14; x <= 25; x++) setT(x, y, G.PLAZA, S.OPEN);
  // the arch at the north door, the hawker stalls are businesses (lib/jade-biz.ts places them at 15/18/21/24, 68)
  prop(20, 66, 'hawker-arch', 0, 'none', 'sky', 230);
  const tables: { x: number; y: number }[] = [];
  for (const ty of [71, 74]) for (const tx of [18, 21, 24]) { tables.push({ x: px(tx), y: px(ty) }); }
  place('hoon', 19, 72, 'contact', 'Auntie Hoon'); place('beng', 16, 70, 'contact', 'Ah Beng');
  // the wet market hall and its stalls on the little square
  clearBld(20, 76, 25, 81); c.buildings.push({ x: 20, y: 76, w: 6, h: 6, sprite: 'sg-wetmarket', front: true });
  for (let y = 76; y <= 81; y++) for (let x = 20; x <= 25; x++) { const i = at(x, y); c.ground[i] = G.BLD; c.solid[i] = S.BUILDING; c.flags[i] = 0; }
  dropProps(14, 76, 19, 81, p => p.sprite === 'fountain');
  prop(15, 77, 'stall-fish', 26, 'tall', 'over', 92); prop(19, 77, 'stall-veg', 26, 'tall', 'over', 92);
  place('wetmarket', 17, 78, 'spot', 'Wet market');
  // Uncle Teo's kopitiam on the corner by the alley
  for (const b of c.buildings) if (b.x === 27 && b.y === 73) { b.sprite = 'sg-kopitiam'; b.front = true; }
  place('teo', 28, 76, 'contact', 'Uncle Teo');
  // the kopi stall is a business at (15, 73) (lib/jade-biz.ts)
  const kopi: [number, number] = [px(15), px(73)];

  // ── the HDB block and its void deck (where the shophouse row south of Chef Mo's food court was): the block on the
  // west, the open void deck on the east with Uncle Goh's stone chess table and the mama shop
  clearBld(33, 76, 41, 81);
  for (let y = 76; y <= 81; y++) for (let x = 33; x <= 38; x++) { const i = at(x, y); c.ground[i] = G.BLD; c.solid[i] = S.BUILDING; c.flags[i] = 0; }
  c.buildings.push({ x: 33, y: 76, w: 6, h: 6, sprite: 'sg-hdb', front: true });
  for (let y = 76; y <= 81; y++) for (let x = 39; x <= 41; x++) setT(x, y, G.PLAZA, S.OPEN);
  dropProps(39, 76, 41, 81);
  prop(40, 77, 'chess-table', 24, 'tall', 'over', 70); prop(40, 80, 'mama-shop', 30, 'tall', 'over', 96);
  place('goh', 39, 78, 'contact', 'Uncle Goh'); place('voiddeck', 39, 79, 'spot', 'HDB void deck');

  // ── the getai stage in the docks car park, Lily Sparkle beside it
  prop(56, 69, 'getai-stage', 60, 'tall', 'over', 230); prop(55, 72, 'spirit-seats', 0, 'none', 'over', 110); prop(58, 72, 'spirit-seats', 0, 'none', 'over', 110);
  place('lily', 54, 71, 'contact', 'Lily Sparkle'); place('getai', 56, 71, 'spot', 'Getai stage');
  // Mr Ong the karang guni man starts his round by the void deck
  place('ong', 32, 79, 'contact', 'Mr Ong');

  // ── pastel Peranakan shophouse fronts along Smith Street and a clan house up Temple Street
  let k = 0;
  for (const b of c.buildings) if (b.front && /^shop-\d/.test(b.sprite) && districtAt(b.x, b.y) === 'market') { if (k % 3 === 1) b.sprite = 'shop-sg1'; else if (k % 3 === 2) b.sprite = 'shop-sg2'; k++; }
  const clan = c.buildings.find(b => b.front && b.sprite === 'bld-hill'); if (clan) clan.sprite = 'sg-clan';

  // ── five-foot ways: the covered walk in front of every street-facing shophouse
  const fivefoot = new Uint8Array(W * H);
  for (const b of c.buildings) {
    if (!b.front || b.roof || !/^(shop-|bld-|sg-kopitiam)/.test(b.sprite)) continue;
    const y = b.y + b.h; if (y >= H) continue;
    for (let x = b.x; x < b.x + b.w; x++) { const i = at(x, y); if (c.solid[i] === S.OPEN && c.ground[i] !== G.ROAD && c.ground[i] !== G.SEA && c.ground[i] !== G.CANAL) fivefoot[i] = 1; }
  }

  // ── road-toll gantries over the main roads (one lane pair each way, the whole road width)
  const gantries: Gantry[] = [];
  for (const [axis, tx, ty] of [['h', 50, 30], ['v', 42, 55], ['h', 96, 62], ['v', 90, 38], ['h', 20, 46], ['v', 10, 20]] as ['h' | 'v', number, number][]) {
    gantries.push({ axis, tx, ty, x: axis === 'h' ? px(tx) : (tx + 2) * T, y: axis === 'h' ? (ty + 2) * T : px(ty) });
    c.props.push({ x: axis === 'h' ? px(tx) : (tx + 2) * T, y: axis === 'h' ? (ty + 2) * T : px(ty), sprite: 'gantry', r: 0, solid: 'none', layer: 'sky', w: 4.4 * T, rot: axis === 'h' ? Math.PI / 2 : 0 });
  }

  // ── pigeons, bins, gum, junk and the karang guni round
  const pigeons: [number, number][] = [[px(17), px(80)], [px(36), px(19)], [px(20), px(55)], [px(80), px(40)]];
  const bins: [number, number][] = [[px(14), px(66)], [px(26), px(76)], [px(32), px(79)], [px(12), px(58)], [px(44), px(46)], [px(60), px(46)]];
  for (const [x, y] of bins) c.props.push({ x, y, sprite: 'litter-bin', r: 0, solid: 'none', layer: 'over', w: 40 });
  const gum: [number, number][] = [[px(88), px(36)], [px(44), px(66)], [px(30), px(24)]];
  const round: [number, number][] = [[px(32), px(80)], [px(28), px(76)], [px(28), px(65)], [px(12), px(65)], [px(12), px(49)], [px(28), px(49)], [px(28), px(65)], [px(43), px(65)], [px(43), px(80)]];
  const junk: [number, number][] = [[px(26), px(70)], [px(14), px(66)], [px(41), px(56)], [px(40), px(44)], [px(10), px(53)], [px(30), px(62)], [px(43), px(74)], [px(31), px(59)]];
  const jetties: [number, number][] = [];
  for (const pk of c.parking) if (pk.kind === 'boat') jetties.push([pk.x, pk.y]);
  const silver: [number, number, number, number][] = [[27, 63, 45, 66], [11, 63, 26, 66]];
  c.sg = { fivefoot, hawker: { x0: 14, y0: 67, x1: 25, y1: 75 }, tables, kopi, gantries, pigeons, bins, gum, round, junk,
    chess: [px(40), px(77)], mama: [px(40), px(80)], getai: [px(56), px(71)], jetties, silver };
}
