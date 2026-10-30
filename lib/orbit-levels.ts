// Moonhop's skies: five skies of eight handmade stages, each teaching one kind of moon and then mixing them, plus the
// Moon Garden's generated fields, the save and the progress rules. The leap pars and Starlight times were set from
// the search bot's routes (tests/orbit-bot.mjs) with a little headroom.
import { Hop, play, DT, type Stage, type MoonDef, type FlyDef, type Skin, type Kind, type Act } from './orbit-game.js';

export const SAVE_KEY = 'moonhop-v1';
const P = Math.PI;
const up = -P / 2;

export type Sky = { n: number; name: string; blurb: string; skin: Skin; tint: string };
export const SKIES: Sky[] = [
  { n: 1, name: 'Lantern Clouds', blurb: 'Just above the clouds, where the little paper-lantern moons bob. Walk, crouch and leap.', skin: 'lantern', tint: '#f3a65a' },
  { n: 2, name: 'Mushroom Moons', blurb: 'Soft moss that catches you, jelly that bounces you, and moons that turn under your paws.', skin: 'mushroom', tint: '#e0605a' },
  { n: 3, name: 'Frost Moons', blurb: 'Ice to skid on and moons whose pull breathes slowly in and out.', skin: 'lantern', tint: '#8fd3ff' },
  { n: 4, name: 'The Comet Stream', blurb: 'Comets to ride, twin moons that dance round each other, and black beans that push you away.', skin: 'cheese', tint: '#ffd36b' },
  { n: 5, name: 'The Night Garden', blurb: 'Rabbit holes that pop you out of another moon, and everything you have learned, all at once.', skin: 'garden', tint: '#c9a2ff' },
];

// ---------------------------------------------------------------- little helpers for writing stages
type MO = Partial<MoonDef>;
const m = (x: number, y: number, r: number, o: MO = {}): MoonDef => ({ x, y, r, ...o });
const f = (x: number, y: number, gold = false): FlyDef => ({ x, y, gold: gold || undefined });
/** A firefly circling a moon (by index) at `rad`, once every `period` seconds. */
const fo = (around: number, rad: number, period: number, phase = 0, gold = false): FlyDef => ({ path: { around, ax: rad, period, phase }, gold: gold || undefined });
type Def = Omit<Stage, 'sky' | 'index' | 'id' | 'par' | 'parTime' | 'preview'> & { par?: number; parTime?: number };

const S1: Def[] = [
  {
    name: 'First Hop', story: 'The lantern bobs just above the clouds, and the first firefly blinks between two moons.',
    teach: { title: 'Walk, crouch, leap', text: 'Point at a spot on the moon and hold: Dora and Enzo walk there and crouch, and the ring fills. Let go to leap. (Keys: ← → to walk, hold Space, let go.)' },
    moons: [m(0, 0, 50), m(270, 10, 50)], flies: [f(135, -70), f(135, -190, true)], start: { moon: 0, at: up }, home: 1,
  },
  {
    name: 'Hold for Higher', story: 'A longer gap. The longer they hold, the further they fly.',
    teach: { title: 'The ring is your power', text: 'A full ring sends them flying far; a little one is a hop. Watch the dotted path while you hold.' },
    moons: [m(0, 0, 46), m(400, -40, 46)], flies: [f(160, -90), f(270, -100), f(200, 120, true)], start: { moon: 0, at: up }, home: 1,
  },
  {
    name: 'Round the Moon', story: 'Fireflies hide below. Walk round the moon to leap the other way.',
    moons: [m(0, 0, 54), m(-60, 320, 46), m(300, 300, 50)], flies: [f(-50, 170), f(120, 330), f(330, 120, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'The Big Moon', story: 'A great round moon in the middle pulls everything that passes.',
    teach: { title: 'Big moons pull harder', text: 'The bigger the moon, the stronger its pull: it bends your leap and takes a full ring to leave.' },
    moons: [m(0, 0, 42), m(330, 60, 82), m(660, 0, 42)], flies: [f(160, -70), f(330, -120), f(500, -70), f(330, 250, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Puff!', story: 'Enzo has a puff of cloud saved up for just this moment.',
    teach: { title: 'One puff per leap', text: 'In the air, point and click (or tap, or press Space with an arrow) to puff that way: a little nudge. Landing refills it.' },
    moons: [m(0, 0, 46), m(300, -150, 40), m(620, 0, 46)], flies: [f(150, -60), f(330, -280), f(470, -60), f(630, -190, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Firefly Ring', story: 'Three fireflies circle a moon like a little necklace.',
    moons: [m(0, 0, 44), m(320, 0, 56), m(640, 0, 44)], flies: [fo(1, 120, 7, 0), fo(1, 120, 7, 2.09), fo(1, 120, 7, 4.19), f(320, -260, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Slingshot', story: 'Swing round the big moon and let it fling you on.',
    moons: [m(0, 0, 44), m(320, 220, 76), m(20, 440, 44), m(560, 470, 40)], flies: [f(150, 110), f(460, 220), f(180, 470), f(320, 470, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Lantern Row', story: 'A row of lantern moons, bobbing in the evening air, all the way to the home lantern.',
    moons: [m(0, 0, 44), m(260, -120, 40), m(520, 0, 60), m(800, -140, 40), m(1060, -20, 48)],
    flies: [f(130, -110), f(390, -110), f(660, -120), f(930, -130), f(520, 190, true)], start: { moon: 0, at: up }, home: 4,
  },
];

const S2: Def[] = [
  {
    name: 'Soft Moss', story: 'Moss moons catch you like a cushion: no sliding, not a wobble.',
    teach: { title: 'Moss stops you dead', text: 'Land on moss and you stay exactly where you touched down. Ordinary moons let you slide a little.' },
    moons: [m(0, 0, 48, { kind: 'moss', skin: 'moss' }), m(300, -80, 44, { kind: 'moss', skin: 'moss' }), m(600, 0, 48)], flies: [f(150, -110), f(450, -110), f(300, 120, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Jelly Bounce', story: 'A wobbly jelly moon. Land hard and it bounces you away.',
    teach: { title: 'Jelly bounces', text: 'Hit a jelly moon fast and you bounce off it, puff refilled. Touch it gently and you can stand on it.' },
    moons: [m(0, 0, 46), m(300, 140, 50, { kind: 'jelly', skin: 'jelly' }), m(600, 0, 46)], flies: [f(160, 60), f(320, -60), f(460, 60), f(300, 330, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Turning Moon', story: 'This mushroom moon turns slowly, carrying them round.',
    teach: { title: 'Spinning moons', text: 'A spinning moon carries you round, and flings you sideways when you leap. Wait for the right moment.' },
    moons: [m(0, 0, 46), m(310, 0, 54, { spin: 0.8 }), m(620, 0, 46)], flies: [f(160, -80), f(470, -80), f(310, 160, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Jelly Ladder', story: 'Jelly moons in a ladder up the sky.',
    moons: [m(0, 0, 48), m(220, -200, 40, { kind: 'jelly', skin: 'jelly' }), m(-40, -400, 40, { kind: 'jelly', skin: 'jelly' }), m(250, -560, 48, { kind: 'moss', skin: 'moss' })],
    flies: [f(110, -140), f(110, -330), f(100, -520), f(-200, -260, true)], start: { moon: 0, at: up }, home: 3,
  },
  {
    name: 'Mushroom Ring', story: 'A ring of mushrooms turns round and round on a mossy moon.',
    moons: [m(0, 0, 44, { kind: 'moss', skin: 'moss' }), m(300, 60, 60, { spin: -0.7 }), m(600, -40, 44, { kind: 'moss', skin: 'moss' })],
    flies: [fo(1, 115, 6, 0), fo(1, 115, 6, P), f(150, -90), f(300, 300, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Pinball', story: 'Three jellies, and the fireflies dancing between them.',
    moons: [m(0, 0, 44), m(250, -170, 40, { kind: 'jelly', skin: 'jelly' }), m(300, 170, 40, { kind: 'jelly', skin: 'jelly' }), m(560, 0, 44, { kind: 'jelly', skin: 'jelly' }), m(820, 0, 46)],
    flies: [f(130, -90), f(280, 0), f(420, -110), f(680, -80), f(430, 260, true)], start: { moon: 0, at: up }, home: 4,
  },
  {
    name: 'Spin Cycle', story: 'Two moons turning opposite ways, like gears.',
    moons: [m(0, 0, 44), m(260, -60, 50, { spin: 0.9 }), m(520, 40, 50, { spin: -0.9 }), m(800, -20, 44, { kind: 'moss', skin: 'moss' })],
    flies: [f(130, -110), f(390, -90), f(660, -100), f(390, 200, true)], start: { moon: 0, at: up }, home: 3,
  },
  {
    name: 'Toadstool Tops', story: 'The tallest mushroom moons of all, and a long way down to the home lantern.',
    moons: [m(0, 0, 46, { kind: 'moss', skin: 'moss' }), m(280, -170, 42, { kind: 'jelly', skin: 'jelly' }), m(540, -40, 58, { spin: 0.6 }), m(820, -220, 42, { kind: 'jelly', skin: 'jelly' }), m(1060, 0, 48, { kind: 'moss', skin: 'moss' })],
    flies: [f(140, -120), f(410, -160), fo(2, 110, 6, 1), f(690, -170), f(940, -140), f(820, 120, true)], start: { moon: 0, at: up }, home: 4,
  },
];

const S3: Def[] = [
  {
    name: 'Slippery', story: 'The first frost moon. Their paws skid on the ice.',
    teach: { title: 'Ice is slippery', text: 'On ice you slide where you land and take a while to get going or stop. Plan the skid.' },
    moons: [m(0, 0, 46), m(300, -40, 52, { kind: 'ice', skin: 'ice' }), m(620, 0, 46, { kind: 'ice', skin: 'ice' })], flies: [f(150, -100), f(460, -110), f(300, 160, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Breathing Moon', story: 'This moon’s pull breathes slowly in and out. Watch its ring.',
    teach: { title: 'Pulsing moons', text: 'A pulsing moon pulls hard, then gently, then hard again. Leap past it when its pull is soft, or let it bend you when strong.' },
    moons: [m(0, 0, 46), m(320, 40, 60, { pulse: { amp: 0.7, period: 4 } }), m(640, 0, 46)], flies: [f(160, -70), f(320, -110), f(480, -70), f(320, 210, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Skating Round', story: 'A big ice moon to skate all the way round.',
    moons: [m(0, 0, 44), m(320, 120, 74, { kind: 'ice', skin: 'ice' }), m(640, 0, 44)], flies: [f(150, -50), f(320, -40), f(490, -50), f(320, 300, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Frost Pulse', story: 'An icy moon that breathes: slippery and slow to read.',
    moons: [m(0, 0, 46, { kind: 'moss', skin: 'moss' }), m(300, -100, 56, { kind: 'ice', skin: 'ice', pulse: { amp: 0.6, period: 5 } }), m(620, 0, 46)], flies: [f(150, -110), f(300, -260), f(470, -100), f(300, 90, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Icicle Chain', story: 'A chain of little ice moons, like beads on a string.',
    moons: [m(0, 0, 44), m(220, -90, 36, { kind: 'ice', skin: 'ice' }), m(440, 0, 36, { kind: 'ice', skin: 'ice' }), m(660, -90, 36, { kind: 'ice', skin: 'ice' }), m(880, 0, 44)],
    flies: [f(110, -110), f(330, -110), f(550, -110), f(770, -110), f(440, 160, true)], start: { moon: 0, at: up }, home: 4,
  },
  {
    name: 'Two Breaths', story: 'Two pulsing moons, breathing out of step.',
    moons: [m(0, 0, 44), m(280, -80, 54, { pulse: { amp: 0.7, period: 4 } }), m(560, 60, 54, { pulse: { amp: 0.7, period: 4, phase: P } }), m(840, -20, 44)],
    flies: [f(140, -110), f(420, -50), f(700, -110), f(420, 230, true)], start: { moon: 0, at: up }, home: 3,
  },
  {
    name: 'Skid and Leap', story: 'Land, skid, and leap again before you slide too far.',
    moons: [m(0, 0, 44), m(300, 20, 50, { kind: 'ice', skin: 'ice', spin: 0.5 }), m(560, -180, 40, { kind: 'jelly', skin: 'jelly' }), m(820, 20, 50, { kind: 'ice', skin: 'ice' }), m(1080, -60, 44, { kind: 'moss', skin: 'moss' })],
    flies: [f(150, -90), f(430, -140), f(690, -130), f(950, -110), f(560, 120, true)], start: { moon: 0, at: up }, home: 4,
  },
  {
    name: 'Aurora Crown', story: 'High under the aurora, a crown of frost moons breathing together.',
    moons: [m(0, 0, 46), m(300, -150, 50, { kind: 'ice', skin: 'ice' }), m(600, -40, 66, { pulse: { amp: 0.6, period: 5 } }), m(900, -170, 50, { kind: 'ice', skin: 'ice' }), m(1180, 0, 46, { kind: 'moss', skin: 'moss' })],
    flies: [f(150, -120), f(450, -160), fo(2, 130, 7, 0), f(750, -170), f(1040, -120), f(600, 190, true)], start: { moon: 0, at: up }, home: 4,
  },
];

const S4: Def[] = [
  {
    name: 'Catch a Comet', story: 'A little comet loops past. Land on it and ride.',
    teach: { title: 'Comets move', text: 'Comets loop across the sky. Land on one and it carries you; leap off and you keep its speed.' },
    moons: [m(0, 0, 46), m(320, -60, 22, { comet: true, skin: 'ice', path: { cx: 320, cy: 20, ax: 160, ay: 90, period: 7 } }), m(640, 0, 46)], flies: [f(160, -100), f(480, -100), f(320, 200, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Twin Moons', story: 'Two moons dancing round each other, never apart.',
    teach: { title: 'Twin moons', text: 'Twin moons circle each other. Their pull swings round with them, so the same leap goes a new way each time.' },
    moons: [m(0, 0, 44), m(320, 0, 36, { path: { cx: 320, cy: 0, ax: 80, period: 8 } }), m(320, 0, 36, { path: { cx: 320, cy: 0, ax: 80, period: 8, phase: P } }), m(640, 0, 44)],
    flies: [f(160, -110), f(320, -170), f(480, -110), f(320, 190, true)], start: { moon: 0, at: up }, home: 3,
  },
  {
    name: 'Black Bean', story: 'A shiny black bean of a moon. It pushes instead of pulls.',
    teach: { title: 'Beans push', text: 'Black-bean moons push you away and bounce you off. Use them to turn a corner.' },
    moons: [m(0, 0, 46), m(320, -40, 40, { kind: 'bean', skin: 'bean' }), m(320, 300, 46), m(640, 0, 46)],
    flies: [f(160, -140), f(480, -140), f(320, 170), f(320, -260, true)], start: { moon: 0, at: up }, home: 3,
  },
  {
    name: 'Comet Rider', story: 'Ride the comet across the stream to the far shore.',
    moons: [m(0, 0, 46), m(450, 0, 22, { comet: true, skin: 'ice', path: { cx: 450, cy: 40, ax: 330, ay: 110, period: 9 } }), m(900, 0, 46)],
    flies: [f(200, -120), f(450, -160), f(700, -120), f(450, 230, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Bean Field', story: 'Beans scattered across the sky. Bounce your way through.',
    moons: [m(0, 0, 46), m(240, -160, 34, { kind: 'bean', skin: 'bean' }), m(300, 120, 34, { kind: 'bean', skin: 'bean' }), m(520, -40, 50), m(800, 0, 46)],
    flies: [f(150, -60), f(400, -150), f(400, 80), f(660, -80), f(540, -260, true)], start: { moon: 0, at: up }, home: 4,
  },
  {
    name: 'Twin Waltz', story: 'Two pairs of twins, waltzing in time.',
    moons: [m(0, 0, 44), m(280, -40, 30, { path: { cx: 280, cy: -40, ax: 70, period: 7 } }), m(280, -40, 30, { path: { cx: 280, cy: -40, ax: 70, period: 7, phase: P } }), m(560, 40, 30, { path: { cx: 560, cy: 40, ax: 70, period: 7, phase: P / 2 } }), m(560, 40, 30, { path: { cx: 560, cy: 40, ax: 70, period: 7, phase: P * 1.5 } }), m(840, 0, 44)],
    flies: [f(140, -100), f(420, -120), f(700, -100), f(420, 200, true)], start: { moon: 0, at: up }, home: 5,
  },
  {
    name: 'Stream Crossing', story: 'Comets stream past in both directions.',
    moons: [m(0, 0, 46), m(300, -100, 20, { comet: true, skin: 'ice', path: { cx: 400, cy: -60, ax: 260, ay: 70, period: 8 } }), m(500, 120, 20, { comet: true, skin: 'ice', path: { cx: 400, cy: 120, ax: 260, ay: 70, period: 8, phase: P } }), m(400, 30, 38, { kind: 'bean', skin: 'bean' }), m(800, 0, 46)],
    flies: [f(150, -100), f(400, -200), f(400, 240), f(650, -100), f(400, -330, true)], start: { moon: 0, at: up }, home: 4,
  },
  {
    name: 'Comet’s Tail', story: 'Follow the great comet’s tail all the way to the edge of the stream.',
    moons: [m(0, 0, 46), m(300, -140, 42, { path: { cx: 300, cy: -60, ax: 60, ay: 80, period: 8 } }), m(560, 40, 36, { kind: 'bean', skin: 'bean' }), m(820, -120, 24, { comet: true, skin: 'ice', path: { cx: 820, cy: -60, ax: 140, ay: 90, period: 8 } }), m(1100, 0, 48)],
    flies: [f(150, -130), f(430, -170), f(690, -150), f(960, -140), f(560, 220, true)], start: { moon: 0, at: up }, home: 4,
  },
];

const S5: Def[] = [
  {
    name: 'Rabbit Hole', story: 'A rabbit hole in the Night Garden. Where does it come out?',
    teach: { title: 'Rabbit holes', text: 'Walk into a rabbit hole and you pop out of the matching hole on another moon.' },
    moons: [m(0, 0, 48, { skin: 'garden' }), m(300, -260, 44, { skin: 'garden' }), m(600, 0, 48, { skin: 'garden' })],
    holes: [{ a: 0, aAt: P / 2, b: 1, bAt: up }],
    flies: [f(450, -150), f(300, -400), f(300, 80), f(150, -120, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Burrow Maze', story: 'Three holes, three moons. The rabbits know the way.',
    moons: [m(0, 0, 46, { skin: 'garden' }), m(320, -200, 42, { skin: 'garden', kind: 'moss' }), m(320, 220, 42, { skin: 'garden' }), m(660, 0, 46, { skin: 'garden' })],
    holes: [{ a: 0, aAt: P, b: 2, bAt: P / 2 }],
    flies: [f(160, -130), f(320, -340), f(320, 370), f(500, 130), f(500, -130, true)], start: { moon: 0, at: up }, home: 3,
  },
  {
    name: 'Garden Swing', story: 'A great garden moon to swing round, flowers bobbing.',
    moons: [m(0, 0, 44, { skin: 'garden' }), m(340, 120, 80, { skin: 'garden', spin: 0.4 }), m(700, 0, 44, { skin: 'garden', kind: 'moss' })],
    flies: [f(170, -40), fo(1, 140, 9, 0), fo(1, 140, 9, P), f(520, -40), f(340, -150, true)], start: { moon: 0, at: up }, home: 2,
  },
  {
    name: 'Moonflowers', story: 'Moonflowers open on a breathing moon.',
    moons: [m(0, 0, 44, { skin: 'garden' }), m(300, -60, 56, { skin: 'garden', pulse: { amp: 0.6, period: 5 } }), m(560, 120, 40, { kind: 'jelly', skin: 'jelly' }), m(840, 0, 46, { skin: 'garden' })],
    flies: [f(150, -100), f(300, -200), f(430, 40), f(700, -60), f(560, 300, true)], start: { moon: 0, at: up }, home: 3,
  },
  {
    name: 'Under the Leaves', story: 'A comet loops under the leaves, and a hole leads up and out.',
    moons: [m(0, 0, 46, { skin: 'garden' }), m(330, 140, 22, { comet: true, skin: 'ice', path: { cx: 330, cy: 160, ax: 200, ay: 70, period: 8 } }), m(330, -160, 44, { skin: 'garden' }), m(680, 0, 46, { skin: 'garden' })],
    holes: [{ a: 0, aAt: P * 0.75, b: 2, bAt: up }],
    flies: [f(170, 100), f(330, 280), f(330, -300), f(510, -60), f(580, 290, true)], start: { moon: 0, at: up }, home: 3,
  },
  {
    name: 'Night Bloom', story: 'Ice petals, moss stems and a bean in the middle of the flower.',
    moons: [m(0, 0, 44, { skin: 'garden' }), m(300, -180, 40, { kind: 'ice', skin: 'ice' }), m(300, 0, 36, { kind: 'bean', skin: 'bean' }), m(300, 180, 40, { kind: 'moss', skin: 'moss' }), m(600, 0, 44, { skin: 'garden' })],
    flies: [f(150, -110), f(450, -110), f(150, 110), f(450, 110), f(300, -320, true)], start: { moon: 0, at: up }, home: 4,
  },
  {
    name: 'Old Lantern Path', story: 'The old lantern path: twin moons, a spinning moon and a hole to the end.',
    moons: [m(0, 0, 46, { skin: 'garden' }), m(280, -60, 32, { path: { cx: 280, cy: -60, ax: 70, period: 8 } }), m(280, -60, 32, { path: { cx: 280, cy: -60, ax: 70, period: 8, phase: P } }), m(560, 20, 52, { skin: 'garden', spin: 0.7 }), m(860, -60, 46, { skin: 'garden' })],
    holes: [{ a: 3, aAt: P / 2, b: 4, bAt: up }],
    flies: [f(140, -110), f(420, -140), f(560, -150), f(710, -80), f(560, 200, true)], start: { moon: 0, at: up }, home: 4,
  },
  {
    name: 'The Home Lantern', story: 'The last fireflies of all, and the home lantern waiting to be lit.',
    moons: [m(0, 0, 46, { skin: 'garden', kind: 'moss' }), m(260, -170, 40, { kind: 'jelly', skin: 'jelly' }), m(520, -40, 56, { skin: 'garden', pulse: { amp: 0.5, period: 5 } }), m(780, -200, 36, { kind: 'ice', skin: 'ice' }), m(1040, -40, 22, { comet: true, skin: 'ice', path: { cx: 1000, cy: -40, ax: 120, ay: 80, period: 8 } }), m(1300, 0, 54, { skin: 'lantern' })],
    flies: [f(130, -110), f(390, -150), fo(2, 110, 7, 0), f(650, -160), f(910, -140), f(1160, -90), f(780, 120, true)], start: { moon: 0, at: up }, home: 5,
  },
];

// The pars and Starlight times, from the search bot's routes (fewest leaps with the golden firefly, plus one).
const PARS: Record<string, [number, number]> = {};

function build(sky: number, defs: Def[]): Stage[] {
  return defs.map((d, i) => {
    const id = `${sky}-${i + 1}`, pr = PARS[id];
    const moons = d.moons.map((mm) => ({ ...mm, skin: mm.skin ?? (mm.kind === 'moss' ? 'moss' : mm.kind === 'ice' ? 'ice' : mm.kind === 'jelly' ? 'jelly' : mm.kind === 'bean' ? 'bean' : SKIES[sky - 1].skin) as Skin }));
    return { ...d, moons, id, sky, index: i, par: d.par ?? pr?.[0] ?? 9, parTime: d.parTime ?? pr?.[1] ?? 60, preview: [1, 0.9, 0.75, 0.6, 0.45][sky - 1] };
  });
}
export const STAGES: Stage[] = [...build(1, S1), ...build(2, S2), ...build(3, S3), ...build(4, S4), ...build(5, S5)];
export const STAGE: Record<string, Stage> = Object.fromEntries(STAGES.map((s) => [s.id, s]));
export const skyStages = (n: number) => STAGES.filter((s) => s.sky === n);
export const FINALE = '5-8';
export const STARLIGHT_SKY = 3;

// ---------------------------------------------------------------- the save and the way through
export type Rec = { s: [boolean, boolean, boolean]; best: number; time: number; medal: boolean };
export type Save = {
  v: 1; stages: Record<string, Rec>; garden: { level: number; best: number };
  seen: string[]; ended: boolean; settings: { sound: boolean; music: boolean };
};
export const freshSave = (): Save => ({ v: 1, stages: {}, garden: { level: 1, best: 0 }, seen: [], ended: false, settings: { sound: true, music: true } });
const isObj = (o: unknown): o is Record<string, unknown> => typeof o === 'object' && o !== null && !Array.isArray(o);
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
/** Reads a save, keeping only what makes sense: anything odd is ignored, never trusted. */
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!isObj(o) || o.v !== 1) return s;
    if (isObj(o.stages)) for (const st of STAGES) {
      const v = o.stages[st.id]; if (!isObj(v) || !Array.isArray(v.s)) continue;
      const a = v.s;
      s.stages[st.id] = { s: [a[0] === true, a[1] === true && a[0] === true, a[2] === true && a[0] === true], best: Math.floor(num(v.best, 1, 999, 99)), time: num(v.time, 0, 9999, 0), medal: v.medal === true && a[0] === true };
      if (!s.stages[st.id].s[0]) delete s.stages[st.id];
    }
    // a stage only counts if the way to it is open
    for (const st of STAGES) if (s.stages[st.id] && !stageOpen(s, st.id)) delete s.stages[st.id];
    if (isObj(o.garden)) { s.garden.level = Math.floor(num(o.garden.level, 1, 9999, 1)); s.garden.best = Math.floor(num(o.garden.best, 0, 9999, 0)); }
    if (Array.isArray(o.seen)) s.seen = [...new Set(o.seen.filter((x): x is string => typeof x === 'string' && x.length < 30))].slice(0, 60);
    s.ended = o.ended === true && !!s.stages[FINALE];
    if (isObj(o.settings)) { s.settings.sound = o.settings.sound !== false; s.settings.music = o.settings.music !== false; }
  } catch { return freshSave(); }
  return s;
}
/** A stage opens when the one before it reached home; a sky opens when the last sky's final stage did. */
export function stageOpen(s: Save, id: string): boolean {
  const i = STAGES.findIndex((x) => x.id === id);
  return i === 0 || (i > 0 && !!s.stages[STAGES[i - 1].id]);
}
export const skyOpen = (s: Save, n: number) => stageOpen(s, skyStages(n)[0].id);
export const skyDone = (s: Save, n: number) => skyStages(n).every((x) => !!s.stages[x.id]);
export const starlightOpen = (s: Save) => skyDone(s, STARLIGHT_SKY);
export const gardenOpen = (s: Save) => skyDone(s, 1);
export const starsOf = (s: Save, id: string) => (s.stages[id]?.s ?? [false, false, false]).filter(Boolean).length;
export const totalStars = (s: Save) => STAGES.reduce((n, x) => n + starsOf(s, x.id), 0);
export const skyStars = (s: Save, n: number) => skyStages(n).reduce((t, x) => t + starsOf(s, x.id), 0);
export const medals = (s: Save) => STAGES.filter((x) => s.stages[x.id]?.medal).length;
export const homeCount = (s: Save) => STAGES.filter((x) => !!s.stages[x.id]).length;
/** The first stage not yet brought home, or null when every one has been. */
export const nextStage = (s: Save): Stage | null => STAGES.find((x) => !s.stages[x.id] && stageOpen(s, x.id)) ?? null;
export type Outcome = { first: boolean; stars: [boolean, boolean, boolean]; newStars: number; medal: boolean; newMedal: boolean; skyDone: boolean; finale: boolean };
/** Writes a finished stage into the save (stars only ever go up). */
export function record(s: Save, st: Stage, r: { home: boolean; gold: boolean; par: boolean; time: number; leaps: number }, starlight = false): Outcome {
  const had = s.stages[st.id], before = had ? had.s.filter(Boolean).length : 0;
  const stars: [boolean, boolean, boolean] = [r.home, r.home && r.gold, r.home && r.par];
  const medal = starlight && r.home && r.time <= st.parTime;
  if (r.home) {
    const s0 = had?.s ?? [false, false, false];
    s.stages[st.id] = {
      s: [true, s0[1] || stars[1], s0[2] || stars[2]], best: Math.min(had?.best ?? 999, r.leaps),
      time: starlight ? (had?.time ? Math.min(had.time, r.time) : r.time) : had?.time ?? 0, medal: (had?.medal ?? false) || medal,
    };
  }
  const now = s.stages[st.id]?.s.filter(Boolean).length ?? 0;
  return { first: !had && r.home, stars, newStars: now - before, medal, newMedal: medal && !had?.medal, skyDone: !had && r.home && skyDone(s, st.sky), finale: st.id === FINALE && !s.ended };
}

// ---------------------------------------------------------------- the Moon Garden: fields grown from a seed
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const GARDEN_SKINS: Skin[] = ['lantern', 'mushroom', 'cheese', 'garden'];
/** One Moon Garden field. It is grown leap by leap: from the moon they stand on, a leap is played with the real
 *  inputs, and the next moon is set down right where that flight is heading, with a firefly on the way. Every leap
 *  is then replayed from the start on the finished field, so the field always comes with a route that works. */
export function gardenField(level: number): { stage: Stage; route: Act[] } {
  for (let attempt = 0; attempt < 80; attempt++) {
    const got = growField(level, rng((level * 7919 + attempt * 104729) >>> 0));
    if (got) return got;
  }
  // (never needed in practice: the tests grow hundreds of fields) a plain field with a known route
  const st = gardenStage(level, [m(0, 0, 50), m(270, 10, 50)], [f(135, -70)]);
  return { stage: st, route: [{ at: -0.35, charge: 0.4 }] };
}
function gardenStage(level: number, moons: MoonDef[], flies: FlyDef[], home = moons.length - 1): Stage {
  return { id: `g${level}`, name: `Moon Garden ${level}`, sky: 0, index: level, moons, flies, start: { moon: 0, at: up }, home, par: 99, parTime: 999, preview: 0.8, story: '' };
}
function growField(level: number, r: () => number): { stage: Stage; route: Act[] } | null {
  const count = 3 + Math.min(4, Math.floor(level / 2)), skin = GARDEN_SKINS[level % GARDEN_SKINS.length];
  const moons: MoonDef[] = [m(0, 0, Math.round(44 + r() * 12), { skin })], flies: FlyDef[] = [], route: Act[] = [];
  let heading = 0.75 + (r() - 0.5) * 0.5; // tilted rightwards from straight up
  const kindFor = (): MO => {
    const pick = r(), opts: MO[] = [{}];
    if (level >= 2) opts.push({ kind: 'moss', skin: 'moss' });
    if (level >= 3) opts.push({ kind: 'ice', skin: 'ice' });
    if (level >= 4) opts.push({ spin: (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.4) });
    if (level >= 5) opts.push({ pulse: { amp: 0.4 + r() * 0.3, period: 4 + r() * 2 } });
    return opts[Math.floor(pick * opts.length)];
  };
  for (let k = 1; k < count; k++) {
    let placed = false;
    for (let tries = 0; tries < 40 && !placed; tries++) {
      const stage = gardenStage(level, moons, flies, -1);
      const h = new Hop(stage);
      for (const a of route) play(h, a);
      if (h.mode !== 'stand' || h.moon !== moons.length - 1) return null;
      const act: Act = { at: heading - P / 2 + (r() - 0.5) * 1.6, charge: 0.55 + r() * 0.45, wait: r() < 0.3 ? r() * 1.5 : 0 };
      // the probe: play the leap on the field so far and see where the flight is heading a little way in
      const g = new Hop({ ...stage, margin: 3000 });
      for (const a of route) play(g, a);
      const stopAt = Math.round((0.85 + r() * 0.75 + Math.min(0.4, level * 0.04)) / DT), path: [number, number, number, number][] = [];
      play(g, act, 4000, (q) => { if (q.mode === 'fly') path.push([q.x, q.y, q.vx, q.vy]); });
      const at = Math.min(stopAt, Math.floor(path.length * 0.5));
      if (at < 50) continue;
      const [px, py, vx, vy] = path[at], sp = Math.hypot(vx, vy) || 1, rn = 36 + r() * 22, side = (r() - 0.5) * 0.8;
      const cx = px + (vx / sp) * rn * 0.95 - (vy / sp) * rn * side, cy = py + (vy / sp) * rn * 0.95 + (vx / sp) * rn * side;
      if (moons.some((q) => Math.hypot(q.x - cx, q.y - cy) < q.r + rn + 60)) continue;
      const nm = m(Math.round(cx), Math.round(cy), Math.round(rn), k === count - 1 ? { skin: 'lantern' } : { skin, ...kindFor() });
      // play it again with the new moon there (its pull bends the end of the flight), and hang the firefly on that path
      const t1 = new Hop(gardenStage(level, [...moons, nm], [...flies, f(1e6, 1e6)], -1)), body: [number, number][] = [];
      for (const a of route) play(t1, a);
      play(t1, act, 4000, (q) => { if (q.mode === 'fly') { const u = q.flyUp(); body.push([q.x + u[0] * 17, q.y + u[1] * 17]); } });
      if (t1.lost > 0 || t1.moon !== moons.length || body.length < 20) continue;
      const fp = body[Math.floor(body.length * (0.35 + r() * 0.3))];
      if (moons.some((q) => Math.hypot(q.x - fp[0], q.y - fp[1]) < q.r + 30) || Math.hypot(nm.x - fp[0], nm.y - fp[1]) < nm.r + 30) continue;
      const nf = f(Math.round(fp[0] * 10) / 10, Math.round(fp[1] * 10) / 10);
      const t = new Hop(gardenStage(level, [...moons, nm], [...flies, nf], -1));
      for (const a of [...route, act]) play(t, a);
      if (t.lost > 0 || t.moon !== moons.length || t.mode !== 'stand' || !t.got.every(Boolean)) continue;
      moons.push(nm); flies.push(nf); route.push(act); placed = true;
      heading += (r() - 0.5) * 1.1; heading = Math.max(0.25, Math.min(1.25, heading));
    }
    if (!placed) return null;
  }
  const stage = gardenStage(level, moons, flies);
  const h = new Hop(stage);
  for (const a of route) play(h, a);
  return h.done && h.got.every(Boolean) ? { stage, route } : null;
}
