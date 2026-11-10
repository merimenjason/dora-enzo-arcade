// Cloudsteel: the story. What is where in the three areas of the climb to Phuyu Pukara, the cloud fortress (the
// walkable ground, walls, gates, spirit-bridge planks, exits, scenes that start by themselves, signs and scenery),
// who stands where, every line of talk and how it changes as the story goes on, the pickups, the sun-stones and the
// duels. The rules that use all this are in lib/cloudsteel-world.ts.
//
// The story: the Sun Lamp on the Condor Gate has gone dark, and without it the condors cannot find the citadel
// through the mist. Enzo carries the last ember of the Lamp in his lantern; Dora carries the sword. Mallku, captain
// of the sword-kin, smuggles jade through the mist and wants the Lamp to stay dark, so he has hired Atoq the
// sellsword to turn back anyone carrying a flame. At the top, Ukhu the warden will let nobody relight the Lamp who
// cannot turn his blade.
import type { Area, AreaId, Duel, Npc, Pickup, SceneDef, Stone, WorldView } from './cloudsteel-world.js';

const R = (x0: number, z0: number, x1: number, z1: number) => ({ k: 'rect' as const, x0, z0, x1, z1 });
const C = (x: number, z: number, r: number) => ({ k: 'circle' as const, x, z, r });
const N = Math.PI, S = 0, E = Math.PI / 2, W = -Math.PI / 2; // facing north (-z), south, east, west

export type ItemId = 'edge' | 'feather' | 'claw' | 'wick' | 'jade' | 'flame' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7' | 'q8' | 'q9';
export type ItemKind = 'sword' | 'lantern' | 'quipu';
export const ITEMS: Record<ItemId, { name: string; kind: ItemKind; text: string }> = {
  edge: { name: 'the Rain-Tempered Edge', kind: 'sword', text: 'A whetstone of rain-tempered steel. Dora\'s cuts do a fifth more harm.' },
  feather: { name: 'the Condor-Feather Wrap', kind: 'sword', text: 'A silver feather bound to the hilt. Dora\'s cuts break posture a quarter faster.' },
  claw: { name: 'the Puma-Claw Guard', kind: 'sword', text: 'Titu\'s bronze guard. The deflect moment is longer.' },
  wick: { name: 'the Long Wick', kind: 'lantern', text: 'A coil of golden wick. Enzo\'s lantern shines further and wakes the planks that lie deep in the mist.' },
  jade: { name: 'the Jade Glass', kind: 'lantern', text: 'A pane of green jade glass for Enzo\'s lantern. Its light opens jade seals.' },
  flame: { name: 'the Second Flame', kind: 'lantern', text: 'The ember Mallku stole from the Lamp. Enzo\'s meter fills faster and his lantern strikes harder.' },
  q1: { name: 'a quipu', kind: 'quipu', text: '"Year of the long rain. The Lamp burned all night and the condors came home."' },
  q2: { name: 'a quipu', kind: 'quipu', text: '"Forty bales of wool to the gate. Twelve came back as jade. The kin do not count honestly."' },
  q3: { name: 'a quipu', kind: 'quipu', text: '"Qori, apprentice bell-keeper, rang the mist bell nine hundred times. Her arms are sore."' },
  q4: { name: 'a quipu', kind: 'quipu', text: '"The spirit bridges remember the Lamp. Show them its flame and they will hold you."' },
  q5: { name: 'a quipu', kind: 'quipu', text: '"Titu came up from the valley with two knives and no name. He learned the name. He kept the knives."' },
  q6: { name: 'a quipu', kind: 'quipu', text: '"The porters\' grandmothers carried the jade glass. Their grandchildren still do."' },
  q7: { name: 'a quipu', kind: 'quipu', text: '"Below, here, above. The serpent, the puma, the condor. Climb as the river climbs."' },
  q8: { name: 'a quipu', kind: 'quipu', text: '"Mallku\'s ledger: one ember, taken from the Lamp the night it went out."' },
  q9: { name: 'a quipu', kind: 'quipu', text: '"Ukhu, warden, three hundred winters. He has never once lost a duel. He hopes to."' },
};
export const QUIPUS = 9;
export const WORLDS_ORDER = ['serpent', 'puma', 'condor'] as const;

// ---------------------------------------------------------------- the three areas
export const AREAS: Record<AreaId, Area> = {
  terrace: {
    id: 'terrace', name: 'The Rain Terrace', spawn: { x: 0, z: 11, face: N },
    walk: [R(-7, 2, 7, 13), R(-3, -1, 3, 3), C(0, -8, 9.2), R(-2.6, -28, 2.6, -16), R(8, -10, 17.5, -6), C(25, -8, 9), R(-11.5, 8, -6.5, 12), R(-14, -5, -10, 12)],
    solid: [R(-10.2, 1, -7.4, 7)],
    gates: [{ id: 'sun', shape: R(-2.6, -26, 2.6, -24.6), seal: 'sun' }],
    planks: [],
    exits: [{ shape: R(-2.6, -28, 2.6, -26.8), to: 'forest', x: 0, z: 9, face: N }],
    triggers: [{ id: 'start', shape: C(0, 11, 2), scene: 'start' }],
    signs: [{ id: 'bell', x: -6.8, z: 9.6, scene: 'bell', label: 'Look at the mist bell' }],
    props: [
      { kind: 'bellhouse', x: -8.8, z: 4 }, { kind: 'arena', x: 0, z: -8 }, { kind: 'temple', x: 0, z: -40 },
      { kind: 'post', x: -6, z: 12.4, solid: 0.25 }, { kind: 'post', x: 6.6, z: 3, solid: 0.25 }, { kind: 'post', x: -2.4, z: -17.5, solid: 0.25 }, { kind: 'post', x: 2.4, z: -17.5, solid: 0.25 },
      { kind: 'post', x: 16, z: -10.4, solid: 0.25 }, { kind: 'post', x: -13.6, z: -4.6, solid: 0.25 },
      { kind: 'gate', x: 0, z: -25.3 }, { kind: 'stairs', x: 0, z: -21, s: 10 },
      { kind: 'tree', x: -12.2, z: 3, s: 1.1 }, { kind: 'bush', x: -10.8, z: 11.5 }, { kind: 'bush', x: 6.4, z: 12.6 }, { kind: 'tree', x: 31, z: -14, s: 1.2 }, { kind: 'bush', x: 30, z: -1.5 },
      { kind: 'fern', x: 9, z: -11 }, { kind: 'fern', x: 15, z: -5.5 }, { kind: 'bamboo', x: -13, z: -6.4 },
    ],
  },
  forest: {
    id: 'forest', name: 'The Cloud-Forest Path', spawn: { x: 0, z: 9, face: N },
    walk: [R(-3, -6, 3, 12), R(-3, -12, 15, -6), R(15, -9.5, 21, -7.5), R(8, -27, 14, -12), R(2, -52, 20, -44.5), C(10, -60, 9), R(7, -80, 13, -68), C(-18, -49, 8.5)],
    solid: [],
    gates: [],
    planks: [
      // the spirit bridge over the gorge, and the branch west to Titu's glade: its middle planks lie deep in the mist
      // and only wake for the long wick
      ...Array.from({ length: 12 }, (_, i) => ({ id: `b${i}`, x: 11, z: -27.6 - i * 1.5, hx: 1.3, hz: 0.85 })),
      ...[1.2, -0.3, -1.8, -3.3, -4.8, -6.3, -7.8, -9.3].map((x, i) => ({ id: `s${i}`, x, z: -48.5, hx: 0.85, hz: 1.3, deep: i >= 2 && i <= 4 })),
    ],
    exits: [{ shape: R(-3, 11.3, 3, 12), to: 'terrace', x: 0, z: -22.5, face: S }, { shape: R(7, -80, 13, -78.6), to: 'citadel', x: 0, z: 9, face: N }],
    triggers: [
      { id: 'forest', shape: C(0, 9, 2.5), scene: 'forest' },
      { id: 'crossed', shape: R(2, -52, 20, -45.2), scene: 'crossed' },
    ],
    signs: [{ id: 'gorge', x: 9, z: -26.4, scene: 'gorge', label: 'Look into the gorge' }],
    props: [
      { kind: 'gorge', x: 11, z: -35.75 }, { kind: 'gorge2', x: -3.7, z: -48.5 }, { kind: 'ropeposts', x: 11, z: -26.9 }, { kind: 'ropeposts', x: 11, z: -44.7 }, { kind: 'ropeposts2', x: 2.1, z: -48.5 }, { kind: 'ropeposts2', x: -9.6, z: -48.5 },
      { kind: 'post', x: 2.6, z: 11, solid: 0.25 }, { kind: 'post', x: 14.4, z: -12.4, solid: 0.25 }, { kind: 'post', x: 7.6, z: -26.6, solid: 0.25 }, { kind: 'post', x: 19.5, z: -45.4, solid: 0.25 }, { kind: 'post', x: 7.5, z: -68.5, solid: 0.25 },
      { kind: 'bamboo', x: 15.2, z: -10.2, s: 1.2 }, { kind: 'bamboo', x: 15.2, z: -6.6, s: 1.1 }, { kind: 'shrine', x: -18, z: -55 },
      // the cloud forest itself: rock pillars rising out of the mist along the path, each with its tree, fern or bamboo
      { kind: 'grove', x: -4.6, z: 10, s: 1.0 }, { kind: 'grove', x: 4.6, z: 7, s: 1.2 }, { kind: 'grove', x: -4.8, z: 3, s: 1.4 }, { kind: 'grove', x: 4.7, z: -1, s: 1.1 }, { kind: 'grove', x: -4.6, z: -4.5, s: 1.3 }, { kind: 'grove', x: -1, z: -13.8, s: 1.0 }, { kind: 'grove', x: 4.5, z: -13.8, s: 1.2 }, { kind: 'grove', x: 16.6, z: -12.6, s: 1.4 }, { kind: 'grove', x: 6.4, z: -16, s: 1.1 }, { kind: 'grove', x: 15.8, z: -17.5, s: 1.3 }, { kind: 'grove', x: 6.3, z: -21.5, s: 1.0 }, { kind: 'grove', x: 15.9, z: -22.5, s: 1.2 }, { kind: 'grove', x: 6.4, z: -26.2, s: 1.4 }, { kind: 'grove', x: 3, z: -42.8, s: 1.1 }, { kind: 'grove', x: 17.5, z: -42.9, s: 1.3 }, { kind: 'grove', x: 21.8, z: -48, s: 1.0 }, { kind: 'grove', x: 21.6, z: -52.5, s: 1.2 }, { kind: 'grove', x: 0.6, z: -53.6, s: 1.4 }, { kind: 'grove', x: 19.2, z: -56, s: 1.1 }, { kind: 'grove', x: -0.8, z: -63, s: 1.3 }, { kind: 'grove', x: 20.4, z: -62.5, s: 1.0 }, { kind: 'grove', x: 3, z: -67.6, s: 1.2 }, { kind: 'grove', x: 17.2, z: -67.8, s: 1.4 }, { kind: 'grove', x: 5.2, z: -73, s: 1.1 }, { kind: 'grove', x: 14.8, z: -73.5, s: 1.3 }, { kind: 'grove', x: 5.3, z: -78.5, s: 1.0 }, { kind: 'grove', x: 14.7, z: -78.8, s: 1.2 }, { kind: 'grove', x: -28.4, z: -49, s: 1.4 }, { kind: 'grove', x: -26, z: -56.2, s: 1.1 }, { kind: 'grove', x: -21.5, z: -58.8, s: 1.3 }, { kind: 'grove', x: -12.4, z: -57, s: 1.0 }, { kind: 'grove', x: -26.4, z: -41.6, s: 1.2 }, { kind: 'grove', x: -18.8, z: -38.6, s: 1.4 }, { kind: 'grove', x: -11.6, z: -41.4, s: 1.1 },
    ],
  },
  citadel: {
    id: 'citadel', name: 'The Citadel Gate', spawn: { x: 0, z: 9, face: N },
    walk: [R(-3, -6, 3, 12), R(-13, -24, 13, -6), R(-2.6, -30, 2.6, -24), C(0, -39, 9.2), R(-23, -17, -13, -13), C(-27, -15, 8.5), R(13, -12, 20, -9)],
    solid: [],
    gates: [
      { id: 'outer', shape: R(-3, -6, 3, -4.6), seal: 'jade' },
      { id: 'west', shape: R(-15, -17, -13, -13), seal: 'jade' },
      { id: 'worlds', shape: R(-2.6, -26, 2.6, -24.2), seal: 'worlds' },
    ],
    planks: [],
    exits: [{ shape: R(-3, 11.3, 3, 12), to: 'forest', x: 10, z: -75, face: S }],
    triggers: [{ id: 'citadel', shape: C(0, 9, 2.5), scene: 'citadel' }],
    signs: [{ id: 'mural', x: -6, z: -6.6, scene: 'mural', label: 'Read the mural' }],
    props: [
      { kind: 'jadegate', x: 0, z: -5.3 }, { kind: 'jadedoor', x: -14, z: -15 }, { kind: 'gate', x: 0, z: -25.1 }, { kind: 'condorgate', x: 0, z: -50 },
      { kind: 'arena', x: 0, z: -39 }, { kind: 'walls', x: 0, z: 0 },
      { kind: 'post', x: -2.6, z: 11, solid: 0.25 }, { kind: 'post', x: 2.6, z: 11, solid: 0.25 }, { kind: 'post', x: -12.4, z: -6.6, solid: 0.25 }, { kind: 'post', x: 12.4, z: -6.6, solid: 0.25 },
      { kind: 'post', x: -12.4, z: -23.4, solid: 0.25 }, { kind: 'post', x: 12.4, z: -23.4, solid: 0.25 }, { kind: 'post', x: -22, z: -17.6, solid: 0.25 },
      { kind: 'tree', x: 19, z: -12.8, s: 1 }, { kind: 'bush', x: -11.5, z: -9 }, { kind: 'bush', x: 11.6, z: -20 },
    ],
  },
};

export const STONES: Stone[] = [
  { id: 'sun', area: 'terrace', x: 3.3, z: -22.6, glyph: 'sun', face: W, scene: 'sunstone' },
  { id: 'serpent', area: 'citadel', x: -8.5, z: -15, glyph: 'serpent', face: E, scene: 'stone-serpent' },
  { id: 'puma', area: 'citadel', x: 0, z: -19.5, glyph: 'puma', face: S, scene: 'stone-puma' },
  { id: 'condor', area: 'citadel', x: 8.5, z: -15, glyph: 'condor', face: W, scene: 'stone-condor' },
];

export const PICKUPS: Pickup[] = [
  { id: 'wick', area: 'terrace', x: -12, z: -3 },
  { id: 'feather', area: 'forest', x: 20, z: -8.5 },
  { id: 'q1', area: 'terrace', x: 6, z: 12 }, { id: 'q2', area: 'terrace', x: 32, z: -8 }, { id: 'q3', area: 'terrace', x: -12.5, z: 10 },
  { id: 'q4', area: 'forest', x: -2.2, z: 10.8 }, { id: 'q5', area: 'forest', x: -23.5, z: -45.5 }, { id: 'q6', area: 'forest', x: 19, z: -51 },
  { id: 'q7', area: 'citadel', x: -12, z: -23 }, { id: 'q8', area: 'citadel', x: -33, z: -11 }, { id: 'q9', area: 'citadel', x: 19, z: -10.5 },
];

export const DUELS: Duel[] = [
  { id: 'atoq', area: 'terrace', title: 'Atoq the Sellsword', x: 0, z: -8, rot: 0, optional: false, retreat: { x: 0, z: 4 }, before: 'atoq-before', after: 'atoq-after',
    foes: [{ kind: 'fox', name: 'Atoq the Sellsword', look: 'atoq' }], stand: [{ x: 0, z: -13, face: S }] },
  { id: 'kin1', area: 'terrace', title: 'The Sword-Kin', x: 25, z: -8, rot: -Math.PI / 2, optional: true, reward: 'edge', retreat: { x: 14, z: -8 }, before: 'kin1-before', after: 'kin1-after',
    foes: [{ kind: 'fox', name: 'Sword-Kin Sami', look: 'kin' }, { kind: 'fox', name: 'Sword-Kin Wayra', look: 'kin' }], stand: [{ x: 28, z: -9.4, face: W }, { x: 28.4, z: -6.6, face: W }] },
  { id: 'ambush', area: 'forest', title: 'The Sword-Kin Ambush', x: 10, z: -60, rot: 0, optional: false, retreat: { x: 11, z: -47 }, before: 'ambush-before', after: 'ambush-after',
    foes: [{ kind: 'fox', name: 'Sword-Kin Illa', look: 'kin' }, { kind: 'fox', name: 'Sword-Kin Kusi', look: 'kin' }], stand: [{ x: 8.6, z: -64.5, face: S }, { x: 11.6, z: -64.8, face: S }] },
  { id: 'titu', area: 'forest', title: 'Titu of the Ferns', x: -18, z: -49, rot: Math.PI / 2, optional: true, reward: 'claw', retreat: { x: -11, z: -48.5 }, before: 'titu-before', after: 'titu-after',
    foes: [{ kind: 'puma', name: 'Titu of the Ferns', look: 'titu' }], stand: [{ x: -21.5, z: -49, face: E }] },
  { id: 'mallku', area: 'citadel', title: 'Mallku, Kin-Captain', x: -27, z: -15, rot: Math.PI / 2, optional: true, reward: 'flame', retreat: { x: -18, z: -15 }, before: 'mallku-before', after: 'mallku-after',
    foes: [{ kind: 'fox', name: 'Mallku, Kin-Captain', look: 'mallku', hp: 200 }, { kind: 'fox', name: 'Sword-Kin Rumi', look: 'kin' }], stand: [{ x: -31, z: -16.4, face: E }, { x: -31.4, z: -13.4, face: E }] },
  { id: 'ukhu', area: 'citadel', title: 'Ukhu, Warden of the Gate', x: 0, z: -39, rot: 0, optional: false, retreat: { x: 0, z: -27 }, before: 'ukhu-before', after: 'ukhu-after',
    foes: [{ kind: 'bear', name: 'Ukhu, Warden of the Gate', look: 'ukhu' }], stand: [{ x: 0, z: -44.5, face: S }] },
];

const turned = (w: WorldView) => w.won('atoq');
export const NPCS: Npc[] = [
  { id: 'qori', who: 'qori', name: 'Qori', area: 'terrace', x: -5.6, z: 5, face: E, scene: 'qori' },
  { id: 'atoq-forest', who: 'atoq', name: 'Atoq', area: 'forest', x: -1.6, z: -9.6, face: E, scene: 'atoq-forest', when: turned },
  { id: 'atoq-citadel', who: 'atoq', name: 'Atoq', area: 'citadel', x: 5.6, z: -8.6, face: W, scene: 'atoq-citadel', when: (w) => turned(w) && w.has('seen:citadel') },
  { id: 'tupa', who: 'tupa', name: 'Tupa', area: 'forest', x: 12.8, z: -23.5, face: W, scene: 'tupa',
    at: (w) => w.has('seen:crossed') ? { area: 'forest', x: 13.4, z: -47.6, face: W } : null },
  // after the duels the foes stay to talk
  { id: 'kin1-after', who: 'kin', name: 'Sami', area: 'terrace', x: 28, z: -8, face: W, scene: 'kin1-later', when: (w) => w.won('kin1') },
  { id: 'titu-after', who: 'titu', name: 'Titu', area: 'forest', x: -21.5, z: -49, face: E, scene: 'titu-later', when: (w) => w.won('titu') },
  { id: 'mallku-after', who: 'mallku', name: 'Mallku', area: 'citadel', x: -31, z: -15, face: E, scene: 'mallku-later', when: (w) => w.won('mallku') },
];

/** talk names */
export const NAMES: Record<string, string> = { dora: 'Dora', enzo: 'Enzo', qori: 'Qori', tupa: 'Tupa', atoq: 'Atoq', kin: 'Sword-Kin', mallku: 'Mallku', titu: 'Titu', ukhu: 'Ukhu', stone: '' };

const D = (text: string, mood?: 1) => ({ who: 'dora' as const, text, mood }), Z = (text: string, mood?: 1) => ({ who: 'enzo' as const, text, mood });
const say = (who: 'qori' | 'tupa' | 'atoq' | 'kin' | 'mallku' | 'titu' | 'ukhu' | 'stone') => (text: string, mood?: 1) => ({ who, text, mood });
const Q = say('qori'), T = say('tupa'), A = say('atoq'), K = say('kin'), M = say('mallku'), P = say('titu'), U = say('ukhu'), X = say('stone');

export const SCENES: Record<string, (w: WorldView) => SceneDef> = {
  // ------------------------------------------------------------ the Rain Terrace
  start: () => ({ lines: [
    Z('There it is. Phuyu Pukara, the cloud fortress. And no light on the Condor Gate.'),
    D('Then we climb until there is. How is the ember?', 1),
    Z('Still burning. Small, but stubborn. Like someone I know.', 1),
    D('Stay close. If the sellsword is up there, he is mine to talk to.'),
  ] }),
  qori: (w) => {
    if (w.has('seen:ukhu-after')) return { lines: [Q('Do you hear that? Wings. Nine hundred bells I rang into the mist, and it was a little lantern that brought them home.'), D('A little lantern and a lot of stubbornness.', 1), Q('The two best things in the mountains.', 1)] };
    if (turned(w) && !w.has('qori2')) return { lines: [
      Q('You turned Atoq\'s blade? Ha! I have waited eleven years to see someone do that.', 1),
      D('He says Mallku paid him to stop anyone carrying a flame.'),
      Q('Mallku. Of course. The mist is good for smugglers and bad for everyone else.'),
      Z('The forest gate is shut. There is a sun carved on the stone beside it.'),
      Q('A sun-stone. It only wakes for a true flame. Lift your lantern to it, little one, and it will know you.', 1),
      Q('And if you want a longer reach, look behind my bell-house. I hid something there when I was your age. Mind the ledge.'),
    ], then: [{ flag: 'qori2' }] };
    if (turned(w)) return { lines: [
      Q(w.got('wick') ? 'Ah, you found my wick. My mother wove it from the Lamp\'s own cord. It reaches across gaps that ordinary light cannot.' : 'Behind the bell-house, along the ledge. Go on. An old vizcacha keeps her promises.'),
      Z(w.got('wick') ? 'It is warm in my hands. Like it remembers something.' : 'We will look. Thank you, Qori.', 1),
      Q('Lift your lantern to the sun-stone by the forest gate. Off you go.', 1),
    ] };
    if (w.has('qori1')) return { lines: [Q('Atoq is on the plaza, past the stairs. He is quick and he is proud. Guard when his blade flashes gold.'), D('Gold means guard. I will remember.', 1)] };
    return { lines: [
      Q('Visitors? At this hour? In this rain? Either you are lost or you are carrying something precious.'),
      Z('An ember of the Sun Lamp. The last one. We mean to light the Condor Gate again.', 1),
      Q('...Then I will stop ringing this bell. I have rung it for nine nights to guide the condors, and not one has come.', 1),
      D('Is the way up open?'),
      Q('No. A sellsword holds the plaza. Atoq. Someone pays him to turn back anyone carrying a light.'),
      Q('Watch his blade. When it flashes gold he is about to strike: that is when you guard. Do it at the very last moment and you will turn it aside.'),
      D('Then he will meet the last moment.', 1),
    ], then: [{ flag: 'qori1' }] };
  },
  bell: () => ({ lines: [X('A bronze mist bell, green with age. The rope is worn smooth from nine nights of ringing.'), D('Qori\'s arms must ache.'), Z('Then let us give her a reason to stop.', 1)] }),
  'atoq-before': (w) => w.has('met:atoq') ? { lines: [A('Back for more? I admire that. Come on, then.', 1), D('This time I am watching for the gold.')], then: [] }
    : { lines: [
      A('Well, well. A lantern on the terrace. Do you know how much I am being paid to put that out?'),
      Z('It is not ours to give. It belongs to the Condor Gate.'),
      A('Everything belongs to somebody, grey one. Tonight it belongs to whoever is still standing.', 1),
      D('Then step aside, or stand there while I go past you.'),
      A('Ha! I like her. Show me some steel, cream-fur.', 1),
    ], then: [{ flag: 'met:atoq' }] },
  'atoq-after': () => ({ lines: [
    A('...Nobody has turned my blade like that since the warden himself.'),
    D('Who is paying you, Atoq?'),
    A('Mallku. Captain of the sword-kin. He moves jade through the mist on the secret paths. A dark Lamp is good business.'),
    Z('And you took his jade.'),
    A('I took his jade. I am giving it back, I think. Keep your ember. I will walk ahead of you and see who else he has hired.', 1),
  ] }),
  sunstone: (w) => w.has('gate:sun') ? { lines: [X('The carved sun glows warm. The forest gate stands open.')] }
    : { lines: [X('A carved sun, cold and dark. The gate beside it will not move.'), Z('It wants the Lamp\'s flame. Let me lift the lantern to it.', 1)] },
  'kin1-before': (w) => ({ lines: w.won('atoq') ? [
    K('You beat Atoq? Then the captain will want you beaten twice.'),
    D('There are two of you.'),
    K('There are always two of us. Duel the Sword-Kin, chinchilla? Win, and Sami gives up her rain-tempered whetstone.', 1),
  ] : [
    K('The captain says nobody passes. Atoq has the plaza. We have the balcony.'),
    D('And if I would rather fight you first?'),
    K('Bold. Duel the Sword-Kin, chinchilla? Win, and Sami gives up her rain-tempered whetstone.', 1),
  ], choice: { yes: 'Duel the Sword-Kin', no: 'Not now' } }),
  'kin1-after': () => ({ lines: [K('...Fine. Take the whetstone. The captain will not hear it from us.'), D('Tell him yourself. I am coming up.', 1)] }),
  'kin1-later': () => ({ lines: [K('Sami is still sulking. I am pretending to be busy.'), Z('You could always just go home.', 1), K('...We could. Nobody ever says that.')] }),

  // ------------------------------------------------------------ the Cloud-Forest Path
  forest: () => ({ lines: [
    Z('Listen. Water everywhere, and the mist is thick enough to drink.'),
    D('Stay where I can see the lantern.', 1),
    Z('Dora. If I lift it up (just press the lantern), it shows more than the path. The old roads up here were made to answer it.'),
  ] }),
  'atoq-forest': (w) => {
    if (w.won('ambush')) return { lines: [A('Illa and Kusi went home with their tails down. Good. The citadel is through the mist to the north.'), A(w.won('titu') ? 'And Titu gave you his guard? He never gives anybody anything.' : 'Titu is still in his glade, if you want a real duel.', 1), D('One fight at a time, Atoq.')] };
    return { lines: [
      A('I told you I would walk ahead. Two of Mallku\'s sword-kin are waiting past the gorge.'),
      D('Then we go through them.'),
      A('There is more. Out west across the gorge lives Titu, an old puma who duels anyone who can find his glade. The planks to it lie deep in the mist.', 1),
      Z('Deep planks... my little wick would never wake those.'),
      A(w.got('wick') ? 'That golden wick of yours might. Qori\'s, isn\'t it?' : 'Then you need a longer wick. Qori always hid things behind her bell-house.', 1),
    ] };
  },
  gorge: (w) => w.isLit('b11') ? { lines: [X('The spirit bridge hangs across the gorge, its planks glowing faintly where the lantern touched them.')] } : { lines: [
    X('Ropes run out into the mist and vanish. There are no planks. A long way below, water roars.'),
    Z('The planks are still there. They are sleeping. I can feel them.', 1),
    D('Then wake them. I will walk where your light shows.'),
  ] },
  tupa: (w) => {
    if (w.has('seen:crossed')) return { lines: [T('I crossed! On planks made of light! My grandmother will not believe me.', 1), Z('Did the jade glass help?'), T('It is yours now. Open the seals at the top, and maybe they will let porters through again.', 1)] };
    if (w.has('tupa1')) return { lines: [T('Hold up the lantern and see what it shows, please. I will be right behind you. Probably.')] };
    return { lines: [
      T('Oh! Oh, please, do not fall in. The bridge is gone. I came up with my pots last week and the bridge just... was not.'),
      D('Gone? The ropes are still here.'),
      Z('It is a spirit bridge. It answers the Lamp\'s flame, and the Lamp has gone dark. That is why it sleeps.', 1),
      T('Can your lantern wake it? I have to get these pots to the citadel. My whole village made them.'),
      Z('Let us find out. Each time I lift it, the planks near us should wake.'),
      D('And then we walk out on them, and lift it again.', 1),
    ], then: [{ flag: 'tupa1' }] };
  },
  crossed: () => ({ lines: [
    T('Wait for me! Wait! I am coming across!'),
    T('...I did not look down. I did not look down once. Here. Take this. It was my grandmother\'s.', 1),
    T('Jade glass. Put it in your lantern and its light will open the jade seals on the citadel doors.'),
    Z('Tupa, this is precious.'),
    T('So are my pots. And so is that ember. Go and light the gate.', 1),
  ], then: [{ give: 'jade' }] }),
  'ambush-before': (w) => w.has('met:ambush') ? { lines: [K('Again? The captain will be pleased with us.'), D('Not for long.', 1)] } : { lines: [
    K('That is far enough. Captain\'s orders: the ember goes into the gorge.'),
    K('Atoq went soft. We have not.', 1),
    D('Enzo, stay by the ferns. Call if you see an opening.'),
    Z('When my lantern is full, I will be there.', 1),
  ], then: [{ flag: 'met:ambush' }] },
  'ambush-after': () => ({ lines: [K('...Go on, then. The captain waits behind a jade door in the citadel\'s west yard. We will not.'), D('Go home, Illa. Kusi. The mist is lifting.', 1)] }),
  'titu-before': (w) => ({ lines: w.has('met:titu') ? [P('Back again. Good. The ferns were getting bored.'), P('Shall we?', 1)] : [
    P('Few find my glade. Fewer find it twice. You walked on a bridge that was not there to reach me.'),
    D('Atoq said you were the best duellist on the mountain.'),
    P('Atoq says many things. Some of them are true.', 1),
    P('When I crouch and my tail lashes, I am about to leap. Do not guard that: get out of the way. Duel with an old puma?'),
  ], choice: { yes: 'Duel Titu', no: 'Not now' }, then: [{ flag: 'met:titu' }] }),
  'titu-after': () => ({ lines: [P('Hah. Hah! Oh, that was good. I have not lost in forty years.', 1), P('Take my guard. It is old bronze from a puma\'s claw: it will give you a breath longer to turn a blade.'), D('Thank you, Titu.'), Z('Will you be all right out here?', 1), P('I have a glade and a stream and nobody bothering me. I will be wonderful.')] }),
  'titu-later': () => ({ lines: [P('Still here? Go and light that Lamp. I would like to see the condors again before I am too old to look up.', 1)] }),

  // ------------------------------------------------------------ the Citadel Gate
  citadel: () => ({ lines: [
    D('There it is. The Condor Gate, and the Lamp on top of it.'),
    Z('Dark. It feels... lonely.', 1),
    D('The door here is sealed with green glass.'),
    Z('Jade. Tupa\'s glass should open it. Let me lift the lantern.'),
  ] }),
  mural: () => ({ lines: [
    X('A carved mural: a river climbs from a serpent at the bottom, past a puma, to a condor at the top. Beneath it: "Climb as the river climbs."'),
    Z('The three worlds. Below, this one, above.'),
    D('And three carved stones in the court. Serpent, puma, condor.', 1),
  ] }),
  'stone-serpent': (w) => ({ lines: [X(w.isLit('serpent') ? 'The serpent stone glows.' : 'A coiled serpent: the world below.')] }),
  'stone-puma': (w) => ({ lines: [X(w.isLit('puma') ? 'The puma stone glows.' : 'A puma: this world, the one we walk in.')] }),
  'stone-condor': (w) => ({ lines: [X(w.isLit('condor') ? 'The condor stone glows.' : 'A condor with spread wings: the world above.')] }),
  'atoq-citadel': (w) => ({ lines: w.won('ukhu') ? [A('You did it. You actually did it. I am going to tell this story very badly for years.', 1)] : [
    A('Ukhu is past the inner gate. He is not one of Mallku\'s. He is the warden, and he has kept that gate for three hundred winters.'),
    D('Then why is the Lamp dark?'),
    A('Mallku stole its ember. Ukhu will let nobody carry a new flame up there who cannot turn his blade. It is the old law.'),
    A(w.won('mallku') ? 'And you have already settled Mallku. I almost feel sorry for him.' : 'Mallku is behind the jade door to the west, if you want your ember back first.', 1),
    Z('Steel and light. Together.', 1),
  ] }),
  'mallku-before': (w) => ({ lines: w.has('met:mallku') ? [M('You again. Rumi, again.'), M('Well?', 1)] : [
    M('So you are the ones. A sellsword turned, four of my kin sent home, and a llama with jade glass.'),
    D('You stole the Lamp\'s ember.'),
    M('I borrowed the dark. Do you know how much jade moves through a good mist?', 1),
    Z('Give it back, Mallku.'),
    M('Take it, if you can. Duel the captain?'),
  ], choice: { yes: 'Duel Mallku', no: 'Not now' }, then: [{ flag: 'met:mallku' }] }),
  'mallku-after': () => ({ lines: [M('Enough! Enough. Take it. It never burned right for me anyway.'), Z('It is the Lamp\'s own ember. Now my lantern has two flames.', 1), D('Go down the mountain, Mallku. And take your kin home.')] }),
  'mallku-later': () => ({ lines: [M('I am leaving. I am packing. Stop looking at me.', 1)] }),
  'ukhu-before': (w) => w.has('met:ukhu') ? { lines: [U('Again. Good. A blade that comes back is worth more than one that never falls.'), D('I am ready, warden.', 1)] } : { lines: [
    U('Three hundred winters I have kept this gate. I have seen many flames carried up these stairs.'),
    U('Some to light the Lamp. Some to burn the citadel. They all looked the same from here.', 1),
    Z('This is the Lamp\'s own ember. We carried it from the valley shrine.'),
    U('Then the law is simple. Turn my blade, and you may light it. My glaive sweeps wide, thrusts long, and when it rises high the ground itself will break: get clear of the green ring.'),
    D('Then let us begin.', 1),
  ], then: [{ flag: 'met:ukhu' }] },
  'ukhu-after': (w) => ({ lines: [
    U('...Steel and light, together. That is what the old law was waiting for.'),
    U('Go. The Lamp is yours to light.', 1),
    Z('Dora... hold the staff with me?'),
    D('Together.', 1),
    ...(w.quipus >= QUIPUS ? [X('Every quipu on the mountain is in your satchel. As the Lamp catches, Qori\'s bell rings far below, nine times, for the nine cords.')] : []),
  ], then: [{ end: true }] }),
};
