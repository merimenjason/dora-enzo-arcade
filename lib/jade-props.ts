// Jade Street (tenth pass): the Chinatown empire's properties beyond the first eleven stalls. Fifteen more places to
// buy across every district (shophouses, a karaoke lounge, a bumboat service, a zi char kitchen, a kopitiam, a taxi
// company, a provision shop, a rooftop bar, an ice kacang cart, a prata shop, a spice shophouse, a Haji Lane café, a
// textile house, a beach bar and a kayak hire). They share the stalls' rules (lib/jade-biz.ts BIZ): a stake to buy,
// two upgrades, nightly takings in a till. Positions are pavement tiles clear of every place, prop and door, found by
// a search over the finished city. Pure data; no imports at run time.
import type { District } from './jade-city.js';
import type { Good } from './jade-trade.js';

/** what a property is (the empire jobs each property offers, its painted sign, the ledger's icon) */
export type PropKind = 'stall' | 'food' | 'shophouse' | 'karaoke' | 'bumboat' | 'taxi' | 'bar' | 'shop' | 'kayak';
/** a business or property: `at` its pavement tile, `price` the stake, `up` the two upgrades, `income` a night's takings
 * at levels 0 to 3, `rain` how a shower changes trade, `need` the district reputation the keepers want */
export type PropDef = { id: string; name: string; keeper: string; d: District; at: [number, number]; good: Good | null; price: number; up: [number, number]; income: [number, number, number, number]; rain: number; need: number; kind?: PropKind;
  /** the painted stand it shares (the twelfth pass's properties reuse the tenth's paintings of the same trade) */
  art?: string };

/** one rule for every property's numbers (the tenth pass rebalanced the first eleven to it too): upgrades cost 0.8 and
 * 1.3 of the stake, and a night's takings are 0.3, 0.5 and 0.74 of it at each level, so each step pays for itself in
 * three to six nights and a careful player owns everything in three to five hours (tests/jade-empire.mjs) */
export const UP_K: [number, number] = [0.8, 1.3];
export const INCOME_K: [number, number, number] = [0.3, 0.5, 0.74];
const r10 = (x: number) => Math.round(x / 10) * 10;
export const upOf = (price: number): [number, number] => [r10(price * UP_K[0]), r10(price * UP_K[1])];
export const incomeOf = (price: number): [number, number, number, number] => [0, Math.round(price * INCOME_K[0]), Math.round(price * INCOME_K[1]), Math.round(price * INCOME_K[2])];
const P = (id: string, name: string, keeper: string, d: District, at: [number, number], price: number, rain: number, need: number, kind: PropKind, art?: string): PropDef =>
  ({ id, name, keeper, d, at, good: null, price, up: upOf(price), income: incomeOf(price), rain, need, kind, ...(art ? { art } : {}) });

export const PROPS: PropDef[] = [
  P('shophouse', 'Pagoda Street Shophouse', 'kee', 'market', [22, 50], 1050, 1, 18, 'shophouse'),
  P('zichar', 'Harbour Zi Char Kitchen', 'bo', 'docks', [70, 80], 1700, 1.15, 20, 'food'),
  P('bumboat', 'Boat Quay Bumboat Service', 'kiri', 'canal', [64, 40], 1300, 0.8, 20, 'bumboat'),
  P('karaoke', 'Club Street Karaoke Lounge', 'lily', 'arcade', [105, 29], 1500, 1.2, 22, 'karaoke'),
  P('kopitiam', 'Toa Payoh Kopitiam', 'teo', 'heartland', [121, 26], 1200, 1.2, 12, 'food'),
  P('taxi', 'ComfortDelGro Taxi Depot', 'kamal', 'heartland', [165, 35], 2600, 1.3, 18, 'taxi'),
  P('provision', 'Void Deck Provision Shop', 'goh', 'heartland', [149, 11], 950, 1, 10, 'shop'),
  P('rooftop', 'Bayfront Rooftop Bar', 'vanda', 'bay', [161, 66], 3000, 0.8, 20, 'bar'),
  P('icekacang', 'Marina Ice Kacang Cart', 'vanda', 'bay', [184, 59], 800, 0.85, 10, 'food'),
  P('prata', 'Race Course Prata Shop', 'malar', 'india', [223, 29], 1350, 1.15, 12, 'food'),
  P('spice', 'Serangoon Spice Shophouse', 'raju', 'india', [237, 11], 1850, 1, 15, 'shophouse'),
  P('cafe', 'Haji Lane Café', 'wangi', 'glam', [221, 58], 1450, 1.1, 12, 'food'),
  P('textile', 'Arab Street Textile House', 'kancil', 'glam', [243, 53], 2100, 1, 15, 'shop'),
  P('beachbar', 'Siloso Beach Bar', 'duyung', 'resort', [93, 118], 2700, 0.75, 15, 'bar'),
  P('kayak', 'Siloso Kayak Hire', 'helang', 'resort', [111, 111], 2250, 0.7, 15, 'kayak'),
  // the twelfth pass: two on Orchard Road, two in Katong, two in Changi Village (raided by the Atas Bats)
  P('emerald', 'Emerald Hill Café', 'tiara', 'orchard', [277, 21], 1600, 1.1, 12, 'food', 'cafe'),
  P('lounge', 'Orchard Road Rooftop Lounge', 'tiara', 'orchard', [317, 32], 3200, 0.8, 15, 'bar', 'rooftop'),
  P('laksahouse', 'Katong Laksa House', 'rosie', 'katong', [296, 55], 1500, 1.15, 10, 'food', 'prata'),
  P('joochiat', 'Joo Chiat Shophouse', 'rosie', 'katong', [323, 56], 2000, 1, 12, 'shophouse', 'spice'),
  P('nasilemak', 'Changi Village Nasi Lemak', 'ubin', 'changi', [328, 55], 1400, 1.15, 12, 'food', 'kopitiam'),
  P('sunset', 'Changi Village Sunset Bar', 'ubin', 'changi', [335, 69], 2800, 0.75, 15, 'bar', 'beachbar'),
  // the fourteenth pass: two in Tiong Bahru (raided by the crows), two at Clarke Quay (the otters), two in Jurong (the lizards)
  P('chweekueh', 'Tiong Bahru Chwee Kueh Stall', 'seng', 'tiong', [257, 124], 1500, 1.15, 10, 'food'),
  P('yongsiak', 'Yong Siak Street Bookshop Café', 'seng', 'tiong', [279, 101], 2100, 1, 12, 'food'),
  P('riversatay', 'Clarke Quay Riverside Satay', 'melati', 'quay', [306, 123], 1700, 1.15, 12, 'food'),
  P('jazzbar', 'Clarke Quay Jazz Lounge', 'melati', 'quay', [326, 118], 3300, 0.8, 15, 'bar'),
  P('lakeshop', 'Jurong Lakeside Lantern Shop', 'musang', 'jurong', [236, 113], 2200, 1, 12, 'shophouse'),
  P('laketea', 'Jurong Lake Tea Garden', 'musang', 'jurong', [240, 102], 1800, 1.1, 12, 'food'),
  // the seventeenth pass: three on Pulau Ubin (raided by the Tusker Boys): a bicycle rental on Jalan Ubin by the jetty
  // lane, a durian stall by the temple, and a kelong seafood shack on the east shore
  P('ubinbikes', 'Jalan Ubin Bicycle Rental', 'ayu', 'pulau', [341, 112], 900, 0.75, 12, 'shop'),
  P('durianstall', 'Kampong Durian Stall', 'lan', 'pulau', [353, 112], 1000, 1.05, 12, 'food'),
  P('kelongseafood', 'Ubin Kelong Seafood', 'belangkas', 'pulau', [359, 118], 1500, 0.9, 15, 'food'),
  // the eighteenth pass: three in Kallang (raided by the crows): a scarf-and-jersey kiosk by Kallang Wave Mall, a satay
  // stall on the Sports Hub's north concourse, and a rowing café on the Kallang Riverside by the boathouse
  P('wavekiosk', 'Kallang Wave Scarf Kiosk', 'tenuk', 'kallang', [184, 109], 1100, 0.9, 12, 'shop'),
  P('hubsatay', 'Sports Hub Satay Stall', 'tenuk', 'kallang', [183, 105], 1300, 1.15, 12, 'food'),
  P('rowcafe', 'Kallang Riverside Rowing Café', 'biru', 'kallang', [149, 102], 1700, 1, 15, 'food'),
];
/** the first eleven, kept as they were placed, with the kind of trade each is */
export const STALL_KIND: Record<string, PropKind> = { noodle: 'food', cake: 'food', tea: 'food', fan: 'shop', jade: 'shop', claw: 'shop', ckt: 'food', chicken: 'food', satay: 'food', laksa: 'food', kopi: 'food' };
/** the rival gang that raids each district's properties (lib/jade-gangs.ts and the Longkang Lizards of the island) */
export const RAID_GANG: Record<District, 'crow' | 'mac' | 'otter' | 'liz' | 'myna' | 'bat' | 'boar'> = { market: 'mac', temple: 'mac', canal: 'otter', docks: 'otter', arcade: 'crow', heartland: 'liz', bay: 'liz', india: 'myna', glam: 'myna', resort: 'myna', orchard: 'bat', katong: 'bat', changi: 'bat', tiong: 'crow', quay: 'otter', jurong: 'liz', pulau: 'boar', kallang: 'crow' };
export const GANG_NAME: Record<string, string> = { crow: 'Kaypoh Crows', mac: 'Bukit Bunch macaques', otter: 'Riverside Romp otters', liz: 'Longkang Lizards', myna: 'Kecoh Mynahs', bat: 'Atas Bats', boar: 'Tusker Boys' };
