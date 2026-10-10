// Moonpond's sprites. Every creature, curiosity and prop is asked for by name through `creature` and `prop`, so the
// drawing behind a name can change without the scene knowing. Today each name is drawn in code. When PAINTED is
// switched on and the sheets in public/art/moonpond/ exist, the same names come from those sheets instead; the
// layout of the sheets and the prompts to paint them are in docs/moonpond-art.md.
import { SPECIES } from './moonpond-game';

type C = CanvasRenderingContext2D;
export type PropKey = 'bobber' | 'lily' | 'lily-flower' | 'reed' | 'lantern' | 'shell';
export const PROPS: PropKey[] = ['bobber', 'lily', 'lily-flower', 'reed', 'lantern', 'shell'];

/** Flip to true once creatures.png (8 columns by 5 rows, journal order) and props.png (6 by 1) are in place. */
export const PAINTED = false;
const SHEETS = { creatures: { src: '/art/moonpond/creatures.png', cols: 8, rows: 5 }, props: { src: '/art/moonpond/props.png', cols: 6, rows: 1 } } as const;
const images: Partial<Record<keyof typeof SHEETS, HTMLImageElement>> = {};
let loading: Promise<void> | null = null;
/** Resolves once the art is ready to draw. Drawn art needs no loading. */
export function loadPondArt(): Promise<void> {
  if (!PAINTED) return Promise.resolve();
  loading ??= Promise.all((Object.keys(SHEETS) as (keyof typeof SHEETS)[]).map((key) => new Promise<void>((done, fail) => {
    const image = new Image(); image.onload = () => { images[key] = image; done(); }; image.onerror = () => fail(new Error(`Moonpond art missing: ${SHEETS[key].src}`)); image.src = SHEETS[key].src;
  }))).then(() => undefined);
  return loading;
}
function painted(c: C, sheet: keyof typeof SHEETS, index: number, x: number, y: number, w: number, h: number) {
  const image = images[sheet]; if (!image) return false;
  const { cols, rows } = SHEETS[sheet], cw = image.width / cols, ch = image.height / rows, k = Math.min(w / cw, h / ch);
  c.drawImage(image, (index % cols) * cw, Math.floor(index / cols) * ch, cw, ch, x - (cw * k) / 2, y - (ch * k) / 2, cw * k, ch * k);
  return true;
}

// ---------- Drawn creatures ----------

type Look = {
  shape: 'fish' | 'eel' | 'frog' | 'newt' | 'crab' | 'shrimp' | 'snail' | 'turtle' | 'ray' | 'skater' | 'mussel' | 'tadpole' | 'button' | 'teacup' | 'bottle' | 'marble' | 'key' | 'bell';
  body: string; belly: string; fin: string; accent?: string;
  /** Body depth against length, for fish. */
  deep?: number; pattern?: 'spots' | 'stripes' | 'stars' | 'bands' | 'crescent'; glow?: string; whiskers?: boolean; sail?: boolean; long?: boolean;
};
const f = (body: string, belly: string, fin: string, more: Partial<Look> = {}): Look => ({ shape: 'fish', body, belly, fin, ...more });
export const LOOKS: Record<string, Look> = {
  'reed-skipper': f('#9fb7a2', '#e8f0dc', '#6f8f7a', { deep: 0.28 }),
  'mud-puppy': { shape: 'tadpole', body: '#7a6248', belly: '#c9b189', fin: '#5b4632' },
  'dusk-newt': { shape: 'newt', body: '#c8643c', belly: '#f2c27a', fin: '#8f3f26', pattern: 'spots', accent: '#3b2418' },
  'rain-peeper': { shape: 'frog', body: '#6fae5a', belly: '#e6f0b8', fin: '#487a3c', accent: '#f0d75a' },
  'cattail-crab': { shape: 'crab', body: '#b5683e', belly: '#e0a878', fin: '#8a4628' },
  'glass-shrimp': { shape: 'shrimp', body: 'rgba(190,230,235,.55)', belly: 'rgba(240,250,250,.7)', fin: '#8fd0d8', accent: '#f08a7a' },
  'lantern-snail': { shape: 'snail', body: '#cdb98f', belly: '#efe2bf', fin: '#f2b84a', glow: '#ffd76a' },
  'lily-hopper': { shape: 'frog', body: '#4f9a6a', belly: '#d9efc6', fin: '#2f6d48', accent: '#f6f0c0', pattern: 'spots' },
  'pad-minnow': f('#c9d6e2', '#f4f8fb', '#8fa6bb', { deep: 0.24 }),
  'whisker-loach': f('#a98f5e', '#e9dcb4', '#7c6640', { deep: 0.2, long: true, whiskers: true, pattern: 'bands', accent: '#6d5632' }),
  'clover-carp': f('#7d9b52', '#e6e7a8', '#56743a', { deep: 0.46, whiskers: true, pattern: 'spots', accent: '#a9c66c' }),
  'mist-darter': f('#b9c4d4', '#eef2f7', '#7f8fa6', { deep: 0.2, pattern: 'stripes', accent: '#6c7c94' }),
  'firefly-guppy': f('#f0b54a', '#fff0b8', '#e8793c', { deep: 0.34, sail: true, glow: '#ffe07a' }),
  'sleepy-terrapin': { shape: 'turtle', body: '#5f7f52', belly: '#c9cf8e', fin: '#3f5a3a', accent: '#8fae6c' },
  'ripple-perch': f('#8aa24c', '#f0e6a0', '#d0633a', { deep: 0.4, pattern: 'bands', accent: '#55682c' }),
  silverside: f('#d7dfe8', '#ffffff', '#9fb0c4', { deep: 0.22, pattern: 'stripes', accent: '#7f93aa' }),
  'pond-bream': f('#c2a55e', '#f4e7b0', '#8f7636', { deep: 0.56 }),
  'dust-skater': { shape: 'skater', body: '#5b4a3c', belly: '#8d7660', fin: '#2e241c' },
  'storm-pike': f('#5d7a5c', '#dfe6b6', '#3f5a40', { deep: 0.2, long: true, pattern: 'spots', accent: '#b7c98a' }),
  'star-sturgeon': f('#56627c', '#c9cfe0', '#3a4460', { deep: 0.22, long: true, whiskers: true, pattern: 'stars', accent: '#f6e7a0' }),
  'fog-ray': { shape: 'ray', body: '#8892a6', belly: '#d7dce6', fin: '#636d82', pattern: 'spots', accent: '#c5ccd9' },
  'channel-chub': f('#7f8a78', '#dfe3d2', '#59634f', { deep: 0.34 }),
  'deepwater-eel': { shape: 'eel', body: '#4a5a52', belly: '#b9c4a8', fin: '#34413a' },
  'pebble-goby': f('#9a8d7c', '#e6ddcd', '#6d6152', { deep: 0.3, pattern: 'spots', accent: '#5e5347' }),
  'night-catfish': f('#3d4254', '#a7abbc', '#2a2e3d', { deep: 0.36, whiskers: true, long: true }),
  'glow-tetra': f('#3fa7c9', '#d8f6ff', '#e0527a', { deep: 0.32, glow: '#8ff0ff', pattern: 'stripes', accent: '#b8f4ff' }),
  'thunder-gar': f('#6a6f4a', '#e3ddb0', '#4a4f30', { deep: 0.17, long: true, pattern: 'spots', accent: '#f0d060' }),
  'velvet-crayfish': { shape: 'crab', body: '#6a3f6e', belly: '#b58fb8', fin: '#4a2a50', long: true },
  'moth-fish': f('#d8cdb8', '#fbf6ea', '#b89f7c', { deep: 0.36, sail: true, pattern: 'spots', accent: '#8a745a' }),
  'pearl-mussel': { shape: 'mussel', body: '#4d5568', belly: '#e9ecf5', fin: '#2f3545', glow: '#f4f7ff' },
  'lost-button': { shape: 'button', body: '#c9614a', belly: '#f0a58f', fin: '#7d3628' },
  'tiny-teacup': { shape: 'teacup', body: '#f2ead8', belly: '#ffffff', fin: '#5b8fb0', accent: '#d98a8a' },
  'bottle-note': { shape: 'bottle', body: 'rgba(150,205,190,.6)', belly: '#f3e6c4', fin: '#a0764a' },
  'glass-marble': { shape: 'marble', body: '#6fb6d8', belly: '#e9f8ff', fin: '#e26f8f', accent: '#f6d35a' },
  'brass-key': { shape: 'key', body: '#c9a24a', belly: '#f3de9c', fin: '#8a6a24' },
  'sunken-bell': { shape: 'bell', body: '#b08a3e', belly: '#e9cf8c', fin: '#6f5420' },
  'ink-eel': { shape: 'eel', body: '#1c1830', belly: '#5a4f8a', fin: '#0f0c1c', glow: '#9a8cff', long: true },
  'crescent-carp': f('#e9e2c4', '#fffbe8', '#c9b46a', { deep: 0.44, whiskers: true, pattern: 'crescent', accent: '#f4d76a', glow: '#fff3b0' }),
  'old-mossback': { shape: 'turtle', body: '#4a6a3e', belly: '#b7c088', fin: '#30472a', accent: '#7fb05a', pattern: 'spots' },
  'moon-koi': f('#f7f7fb', '#ffffff', '#e9a23c', { deep: 0.42, whiskers: true, pattern: 'spots', accent: '#f08a3c', glow: '#dfe9ff', sail: true }),
};

const oval = (c: C, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2); };
const eye = (c: C, x: number, y: number, r: number) => { c.fillStyle = '#16121c'; oval(c, x, y, r, r); c.fill(); c.fillStyle = '#fff'; oval(c, x + r * 0.3, y - r * 0.3, r * 0.35, r * 0.35); c.fill(); };

/** One creature, facing right, about `size` long and centred on the origin. `t` animates it. */
function drawn(c: C, id: string, size: number, t: number, glow = true) {
  const k = LOOKS[id], u = size / 2, line = Math.max(1, size * 0.03), wag = Math.sin(t * 5);
  c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = line; c.strokeStyle = 'rgba(20,16,28,.75)';
  if (k.glow && glow) { const g = c.createRadialGradient(0, 0, u * 0.1, 0, 0, u * 1.25); g.addColorStop(0, k.glow + 'aa'); g.addColorStop(1, k.glow + '00'); c.fillStyle = g; oval(c, 0, 0, u * 1.25, u * 0.9); c.fill(); }
  const fill = (color: string, stroke = true) => { c.fillStyle = color; c.fill(); if (stroke) c.stroke(); };
  if (k.shape === 'fish') {
    const len = k.long ? 1 : 0.82, h = u * (k.deep ?? 0.34) * (k.long ? 1.5 : 1.25) + (k.long ? 0 : u * 0.12), nose = u * len, tail = -u * len * 0.72;
    // Tail.
    c.beginPath(); c.moveTo(tail + u * 0.1, 0); c.quadraticCurveTo(tail - u * 0.2, -h * 0.2, -u * 0.98, -h * 0.75 + wag * u * 0.08); c.quadraticCurveTo(-u * 0.8, wag * u * 0.06, -u * 0.98, h * 0.75 + wag * u * 0.08); c.quadraticCurveTo(tail - u * 0.2, h * 0.2, tail + u * 0.1, 0); fill(k.fin);
    // Back fin.
    c.beginPath(); c.moveTo(-u * 0.2, -h * 0.85); c.quadraticCurveTo(u * 0.02, -h * (k.sail ? 1.75 : 1.4), u * 0.34, -h * 0.8); c.closePath(); fill(k.fin);
    // Body.
    const g = c.createLinearGradient(0, -h, 0, h); g.addColorStop(0, k.body); g.addColorStop(0.55, k.body); g.addColorStop(1, k.belly);
    c.beginPath(); c.moveTo(nose, 0); c.bezierCurveTo(nose * 0.7, -h * 1.15, tail * 0.4, -h * 1.1, tail, -h * 0.12); c.lineTo(tail, h * 0.12); c.bezierCurveTo(tail * 0.4, h * 1.1, nose * 0.7, h * 1.15, nose, 0); fill(g as unknown as string);
    c.save(); c.clip();
    if (k.pattern === 'spots') { c.fillStyle = k.accent!; for (let i = 0; i < 7; i++) { oval(c, nose * (0.5 - i * 0.2), -h * (0.25 + 0.3 * ((i * 7) % 3) / 2) + (i % 2) * h * 0.5, u * 0.06, u * 0.05); c.fill(); } }
    if (k.pattern === 'bands') { c.fillStyle = k.accent!; for (let i = 0; i < 5; i++) c.fillRect(nose * (0.45 - i * 0.26), -h * 1.2, u * 0.09, h * 1.5); }
    if (k.pattern === 'stripes') { c.strokeStyle = k.accent!; c.lineWidth = line * 1.2; c.beginPath(); c.moveTo(nose * 0.6, -h * 0.1); c.lineTo(tail, -h * 0.02); c.stroke(); }
    if (k.pattern === 'stars') { c.fillStyle = k.accent!; for (let i = 0; i < 9; i++) { oval(c, nose * (0.6 - i * 0.17), -h * 0.45 + ((i * 5) % 4) * h * 0.2, u * 0.03, u * 0.03); c.fill(); } }
    if (k.pattern === 'crescent') { c.fillStyle = k.accent!; oval(c, 0, -h * 0.1, u * 0.3, h * 0.7); c.fill(); c.fillStyle = k.body; oval(c, u * 0.12, -h * 0.1, u * 0.27, h * 0.62); c.fill(); }
    c.restore(); c.strokeStyle = 'rgba(20,16,28,.75)'; c.lineWidth = line;
    // Side fin and face.
    c.beginPath(); c.moveTo(nose * 0.3, h * 0.25); c.quadraticCurveTo(nose * 0.1, h * (0.9 + wag * 0.1), -u * 0.05, h * 0.55); c.closePath(); fill(k.fin);
    if (k.whiskers) { c.beginPath(); c.moveTo(nose * 0.92, h * 0.2); c.quadraticCurveTo(nose * 1.05, h * 0.7, nose * 0.8, h * 0.95); c.moveTo(nose * 0.86, h * 0.28); c.quadraticCurveTo(nose * 0.9, h * 0.75, nose * 0.62, h * 0.9); c.stroke(); }
    eye(c, nose * 0.68, -h * 0.28, Math.max(1.2, u * 0.07));
  } else if (k.shape === 'eel') {
    c.lineWidth = u * (k.long ? 0.2 : 0.24); c.strokeStyle = k.fin; c.beginPath();
    for (let i = 0; i <= 24; i++) { const x = -u * 0.95 + (u * 1.75 * i) / 24, y = Math.sin(i * 0.55 + t * 4) * u * 0.2 * (1 - i / 30); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke(); c.lineWidth = u * (k.long ? 0.14 : 0.18); c.strokeStyle = k.body; c.stroke(); c.lineWidth = u * 0.05; c.strokeStyle = k.belly; c.setLineDash([u * 0.06, u * 0.2]); c.stroke(); c.setLineDash([]);
    c.lineWidth = line; c.strokeStyle = 'rgba(20,16,28,.75)'; const hy = Math.sin(24 * 0.55 + t * 4) * u * 0.2 * 0.2;
    oval(c, u * 0.82, hy, u * 0.16, u * 0.12); fill(k.body); eye(c, u * 0.88, hy - u * 0.04, Math.max(1.2, u * 0.045));
  } else if (k.shape === 'frog') {
    oval(c, -u * 0.5, u * 0.3, u * 0.34, u * 0.2, -0.4); fill(k.fin); oval(c, u * 0.15, u * 0.42, u * 0.2, u * 0.1, 0.3); fill(k.fin);
    const g = c.createLinearGradient(0, -u * 0.5, 0, u * 0.5); g.addColorStop(0, k.body); g.addColorStop(1, k.belly); oval(c, -u * 0.1, u * 0.05, u * 0.6, u * 0.42); fill(g as unknown as string);
    oval(c, u * 0.38, -u * 0.12, u * 0.36, u * 0.3); fill(k.body);
    if (k.pattern) { c.fillStyle = k.fin; for (let i = 0; i < 4; i++) { oval(c, -u * 0.4 + i * u * 0.2, -u * 0.12 + (i % 2) * u * 0.14, u * 0.06, u * 0.045); c.fill(); } }
    oval(c, u * 0.42, -u * 0.38, u * 0.13, u * 0.13); fill(k.accent ?? k.belly); eye(c, u * 0.44, -u * 0.38, u * 0.07);
    c.beginPath(); c.moveTo(u * 0.5, -u * 0.02); c.quadraticCurveTo(u * 0.66, u * 0.04, u * 0.72, -u * 0.08); c.stroke();
  } else if (k.shape === 'newt') {
    c.lineWidth = u * 0.16; c.strokeStyle = k.fin; c.beginPath(); c.moveTo(-u * 0.95, wag * u * 0.1); c.quadraticCurveTo(-u * 0.5, -u * 0.25 - wag * u * 0.08, -u * 0.1, 0); c.stroke();
    c.lineWidth = line * 2.2; c.strokeStyle = k.fin; for (const [x, s] of [[-0.1, 1], [-0.1, -1], [0.4, 1], [0.4, -1]] as const) { c.beginPath(); c.moveTo(u * x, 0); c.lineTo(u * (x + 0.14), s * u * 0.34); c.stroke(); }
    c.lineWidth = line; c.strokeStyle = 'rgba(20,16,28,.75)'; oval(c, u * 0.15, 0, u * 0.5, u * 0.17); fill(k.body); oval(c, u * 0.68, 0, u * 0.2, u * 0.15); fill(k.body);
    c.fillStyle = k.accent!; for (let i = 0; i < 5; i++) { oval(c, -u * 0.2 + i * u * 0.17, (i % 2 ? 1 : -1) * u * 0.05, u * 0.04, u * 0.035); c.fill(); }
    eye(c, u * 0.74, -u * 0.06, u * 0.045);
  } else if (k.shape === 'crab') {
    const wide = k.long ? 0.34 : 0.5;
    c.lineWidth = line * 2.4; c.strokeStyle = k.fin; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(s * u * 0.3, u * (0.05 + i * 0.08)); c.lineTo(s * u * (0.72 - i * 0.06), u * (0.3 + i * 0.08) + wag * u * 0.03 * (i % 2 ? 1 : -1)); c.stroke(); }
    c.lineWidth = line; c.strokeStyle = 'rgba(20,16,28,.75)';
    if (k.long) { oval(c, -u * 0.5, 0, u * 0.36, u * 0.17); fill(k.fin); for (let i = 0; i < 3; i++) { oval(c, -u * 0.9 + i * 0.01, (i - 1) * u * 0.12, u * 0.12, u * 0.06, (i - 1) * 0.5); fill(k.body); } }
    const g = c.createLinearGradient(0, -u * 0.3, 0, u * 0.3); g.addColorStop(0, k.body); g.addColorStop(1, k.belly); oval(c, k.long ? u * 0.1 : 0, 0, u * wide, u * 0.3); fill(g as unknown as string);
    for (const s of [-1, 1]) { const x = (k.long ? u * 0.62 : s * u * 0.66), y = k.long ? s * u * 0.3 : -u * 0.24; oval(c, x, y, u * 0.2, u * 0.14, k.long ? s * 0.5 : s * 0.6); fill(k.body); c.beginPath(); c.moveTo(x + u * 0.04, y); c.lineTo(x + u * 0.2, y - u * 0.03); c.stroke(); }
    for (const s of [-1, 1]) eye(c, (k.long ? u * 0.42 : 0) + s * u * 0.12 * (k.long ? 0 : 1) + (k.long ? 0 : 0), k.long ? s * u * 0.12 : -u * 0.3, u * 0.05);
  } else if (k.shape === 'shrimp') {
    c.lineWidth = u * 0.3; c.strokeStyle = k.body; c.beginPath(); c.arc(-u * 0.05, u * 0.25, u * 0.55, -Math.PI * 0.92, -Math.PI * 0.12); c.stroke();
    c.lineWidth = line; c.strokeStyle = k.fin; for (let i = 0; i < 6; i++) { const a = -Math.PI * (0.88 - i * 0.14); c.beginPath(); c.moveTo(-u * 0.05 + Math.cos(a) * u * 0.4, u * 0.25 + Math.sin(a) * u * 0.4); c.lineTo(-u * 0.05 + Math.cos(a) * u * 0.7, u * 0.25 + Math.sin(a) * u * 0.7); c.stroke(); }
    c.strokeStyle = k.accent!; c.beginPath(); c.moveTo(u * 0.45, -u * 0.05); c.quadraticCurveTo(u * 0.8, -u * 0.5, u * 0.95, -u * 0.2 + wag * u * 0.05); c.moveTo(u * 0.45, 0); c.quadraticCurveTo(u * 0.85, -u * 0.25, u * 0.9, u * 0.1); c.stroke();
    c.fillStyle = k.accent!; oval(c, -u * 0.62, u * 0.12, u * 0.14, u * 0.08, -0.8); c.fill(); eye(c, u * 0.4, -u * 0.1, u * 0.05);
  } else if (k.shape === 'snail') {
    c.beginPath(); c.moveTo(-u * 0.7, u * 0.4); c.quadraticCurveTo(0, u * 0.5, u * 0.75, u * 0.38); c.quadraticCurveTo(u * 0.9, u * 0.1, u * 0.62, u * 0.05); c.lineTo(-u * 0.5, u * 0.15); c.closePath(); fill(k.body);
    const g = c.createRadialGradient(-u * 0.1, -u * 0.1, u * 0.05, -u * 0.1, -u * 0.1, u * 0.5); g.addColorStop(0, '#fff6c8'); g.addColorStop(1, k.fin); oval(c, -u * 0.1, -u * 0.08, u * 0.46, u * 0.42); fill(g as unknown as string);
    c.beginPath(); for (let a = 0; a < 9; a += 0.2) { const r = u * 0.045 * a; c.lineTo(-u * 0.1 + Math.cos(a) * r, -u * 0.08 + Math.sin(a) * r); } c.stroke();
    c.beginPath(); c.moveTo(u * 0.66, u * 0.08); c.lineTo(u * 0.78, -u * 0.22); c.moveTo(u * 0.58, u * 0.08); c.lineTo(u * 0.6, -u * 0.2); c.stroke(); eye(c, u * 0.78, -u * 0.24, u * 0.04); eye(c, u * 0.6, -u * 0.22, u * 0.04);
  } else if (k.shape === 'turtle') {
    for (const [x, y] of [[0.5, 0.36], [-0.45, 0.36], [0.5, -0.3], [-0.45, -0.3]]) { oval(c, u * x, u * y + wag * u * 0.02 * (x > 0 ? 1 : -1), u * 0.2, u * 0.11, y > 0 ? 0.5 : -0.5); fill(k.fin); }
    oval(c, -u * 0.72, 0, u * 0.12, u * 0.05); fill(k.fin); oval(c, u * 0.72, -u * 0.02, u * 0.2, u * 0.15); fill(k.accent ?? k.body);
    const g = c.createRadialGradient(-u * 0.05, -u * 0.12, u * 0.05, 0, 0, u * 0.6); g.addColorStop(0, k.accent ?? k.belly); g.addColorStop(1, k.body); oval(c, 0, 0, u * 0.6, u * 0.44); fill(g as unknown as string);
    c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.moveTo(Math.cos(a) * u * 0.22, Math.sin(a) * u * 0.17); c.lineTo(Math.cos(a) * u * 0.56, Math.sin(a) * u * 0.41); } c.stroke(); oval(c, 0, 0, u * 0.22, u * 0.17); c.stroke();
    if (k.pattern) { c.fillStyle = '#9fd07a'; for (let i = 0; i < 6; i++) { oval(c, Math.cos(i * 1.9) * u * 0.38, Math.sin(i * 1.9) * u * 0.28, u * 0.06, u * 0.04); c.fill(); } }
    eye(c, u * 0.78, -u * 0.06, u * 0.045);
  } else if (k.shape === 'ray') {
    c.lineWidth = line * 2; c.strokeStyle = k.fin; c.beginPath(); c.moveTo(-u * 0.3, 0); c.quadraticCurveTo(-u * 0.7, wag * u * 0.1, -u * 0.98, -wag * u * 0.06); c.stroke(); c.lineWidth = line; c.strokeStyle = 'rgba(20,16,28,.75)';
    const flap = wag * u * 0.08; c.beginPath(); c.moveTo(u * 0.7, 0); c.quadraticCurveTo(u * 0.3, -u * 0.3, 0, -u * 0.62 + flap); c.quadraticCurveTo(-u * 0.25, -u * 0.2, -u * 0.4, 0); c.quadraticCurveTo(-u * 0.25, u * 0.2, 0, u * 0.62 - flap); c.quadraticCurveTo(u * 0.3, u * 0.3, u * 0.7, 0);
    const g = c.createRadialGradient(u * 0.1, 0, u * 0.05, u * 0.1, 0, u * 0.7); g.addColorStop(0, k.belly); g.addColorStop(1, k.body); fill(g as unknown as string);
    c.fillStyle = k.accent!; for (let i = 0; i < 8; i++) { oval(c, Math.cos(i * 2.4) * u * 0.28, Math.sin(i * 2.4) * u * 0.3, u * 0.04, u * 0.04); c.fill(); } eye(c, u * 0.42, -u * 0.1, u * 0.04); eye(c, u * 0.42, u * 0.1, u * 0.04);
  } else if (k.shape === 'skater') {
    c.strokeStyle = k.fin; c.lineWidth = line * 1.3; for (const s of [-1, 1]) for (const [x0, x1] of [[0.25, 0.85], [0, -0.1], [-0.2, -0.85]] as const) { c.beginPath(); c.moveTo(u * x0 * 0.5, 0); c.quadraticCurveTo(u * (x0 + x1) * 0.5, s * u * 0.3, u * x1, s * u * (0.45 + wag * 0.03)); c.stroke(); }
    c.strokeStyle = 'rgba(200,225,240,.5)'; for (const s of [-1, 1]) for (const x of [0.85, -0.1, -0.85]) { oval(c, u * x, s * u * 0.45, u * 0.1, u * 0.04); c.stroke(); }
    c.strokeStyle = 'rgba(20,16,28,.75)'; c.lineWidth = line; oval(c, 0, 0, u * 0.36, u * 0.09); fill(k.body); oval(c, u * 0.36, 0, u * 0.09, u * 0.08); fill(k.belly); eye(c, u * 0.4, -u * 0.03, u * 0.03);
  } else if (k.shape === 'mussel') {
    const open = 0.18 + 0.06 * Math.sin(t * 2);
    c.beginPath(); c.moveTo(-u * 0.7, 0); c.quadraticCurveTo(-u * 0.1, u * 0.7, u * 0.75, u * 0.1); c.lineTo(-u * 0.7, 0); fill(k.fin);
    oval(c, u * 0.1, -u * 0.02, u * 0.16, u * 0.16); fill(k.belly, false); c.fillStyle = '#fff'; oval(c, u * 0.06, -u * 0.07, u * 0.05, u * 0.05); c.fill();
    c.beginPath(); c.moveTo(-u * 0.7, 0); c.quadraticCurveTo(-u * 0.2, -u * (0.75 + open), u * 0.75, -u * open); c.quadraticCurveTo(u * 0.1, -u * 0.25, -u * 0.7, 0);
    const g = c.createLinearGradient(0, -u * 0.8, 0, 0); g.addColorStop(0, k.body); g.addColorStop(1, '#7f88a0'); fill(g as unknown as string);
    c.beginPath(); for (let i = 1; i < 5; i++) { c.moveTo(-u * 0.7, 0); c.quadraticCurveTo(-u * 0.2, -u * (0.2 + i * 0.13), u * (0.2 + i * 0.12), -u * (0.3 + open * 0.3)); } c.stroke();
  } else if (k.shape === 'tadpole') {
    c.lineWidth = u * 0.14; c.strokeStyle = k.fin; c.beginPath(); c.moveTo(-u * 0.1, 0); c.quadraticCurveTo(-u * 0.55, wag * u * 0.22, -u * 0.95, -wag * u * 0.14); c.stroke(); c.lineWidth = line; c.strokeStyle = 'rgba(20,16,28,.75)';
    const g = c.createLinearGradient(0, -u * 0.4, 0, u * 0.4); g.addColorStop(0, k.body); g.addColorStop(1, k.belly); oval(c, u * 0.3, 0, u * 0.5, u * 0.36); fill(g as unknown as string);
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(u * 0.05, s * u * 0.26); c.lineTo(-u * 0.08, s * u * 0.44); c.stroke(); } eye(c, u * 0.56, -u * 0.1, u * 0.06);
    c.beginPath(); c.moveTo(u * 0.62, u * 0.1); c.quadraticCurveTo(u * 0.72, u * 0.16, u * 0.78, u * 0.06); c.stroke();
  } else if (k.shape === 'button') {
    oval(c, 0, 0, u * 0.62, u * 0.62); fill(k.body); oval(c, 0, 0, u * 0.46, u * 0.46); fill(k.belly); c.fillStyle = k.fin; for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { oval(c, x * u * 0.14, y * u * 0.14, u * 0.07, u * 0.07); c.fill(); }
    c.strokeStyle = '#f3ead2'; c.beginPath(); c.moveTo(-u * 0.14, -u * 0.14); c.lineTo(u * 0.14, u * 0.14); c.moveTo(u * 0.14, -u * 0.14); c.lineTo(-u * 0.14, u * 0.14); c.stroke();
  } else if (k.shape === 'teacup') {
    c.lineWidth = line * 2.4; c.strokeStyle = k.fin; oval(c, u * 0.5, 0, u * 0.2, u * 0.2); c.stroke(); c.lineWidth = line; c.strokeStyle = 'rgba(20,16,28,.75)';
    c.beginPath(); c.moveTo(-u * 0.52, -u * 0.3); c.lineTo(u * 0.52, -u * 0.3); c.quadraticCurveTo(u * 0.45, u * 0.42, 0, u * 0.44); c.quadraticCurveTo(-u * 0.45, u * 0.42, -u * 0.52, -u * 0.3); fill(k.body);
    oval(c, 0, -u * 0.3, u * 0.52, u * 0.1); fill(k.belly); c.fillStyle = k.fin; c.fillRect(-u * 0.44, -u * 0.12, u * 0.88, u * 0.06); c.fillStyle = k.accent!; for (let i = 0; i < 3; i++) { oval(c, -u * 0.24 + i * u * 0.24, u * 0.12, u * 0.06, u * 0.06); c.fill(); }
  } else if (k.shape === 'bottle') {
    c.save(); c.rotate(-0.25); c.beginPath(); c.roundRect(-u * 0.7, -u * 0.26, u * 0.95, u * 0.52, u * 0.2); fill(k.body); c.beginPath(); c.rect(u * 0.25, -u * 0.1, u * 0.34, u * 0.2); fill(k.body);
    c.beginPath(); c.rect(u * 0.59, -u * 0.12, u * 0.14, u * 0.24); fill(k.fin); c.beginPath(); c.roundRect(-u * 0.5, -u * 0.14, u * 0.55, u * 0.28, u * 0.05); fill(k.belly);
    c.strokeStyle = '#a05a4a'; c.beginPath(); c.moveTo(-u * 0.23, -u * 0.14); c.lineTo(-u * 0.23, u * 0.14); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(-u * 0.58, -u * 0.18); c.lineTo(u * 0.1, -u * 0.18); c.stroke(); c.restore();
  } else if (k.shape === 'marble') {
    const g = c.createRadialGradient(-u * 0.15, -u * 0.18, u * 0.05, 0, 0, u * 0.55); g.addColorStop(0, k.belly); g.addColorStop(1, k.body); oval(c, 0, 0, u * 0.55, u * 0.55); fill(g as unknown as string);
    c.save(); c.clip(); c.lineWidth = u * 0.12; c.strokeStyle = k.fin; c.beginPath(); c.moveTo(-u * 0.5, u * 0.3); c.bezierCurveTo(-u * 0.1, -u * 0.5, u * 0.1, u * 0.5, u * 0.5, -u * 0.3); c.stroke(); c.strokeStyle = k.accent!; c.lineWidth = u * 0.06; c.beginPath(); c.moveTo(-u * 0.5, 0); c.bezierCurveTo(-u * 0.1, -u * 0.6, u * 0.2, u * 0.4, u * 0.5, -u * 0.05); c.stroke(); c.restore();
    c.fillStyle = 'rgba(255,255,255,.8)'; oval(c, -u * 0.2, -u * 0.24, u * 0.1, u * 0.07, -0.6); c.fill();
  } else if (k.shape === 'key') {
    c.save(); c.rotate(-0.3); c.lineWidth = u * 0.14; c.strokeStyle = k.fin; oval(c, -u * 0.5, 0, u * 0.26, u * 0.26); c.stroke(); c.beginPath(); c.moveTo(-u * 0.24, 0); c.lineTo(u * 0.8, 0); c.moveTo(u * 0.5, 0); c.lineTo(u * 0.5, u * 0.24); c.moveTo(u * 0.72, 0); c.lineTo(u * 0.72, u * 0.3); c.stroke();
    c.lineWidth = u * 0.08; c.strokeStyle = k.body; oval(c, -u * 0.5, 0, u * 0.26, u * 0.26); c.stroke(); c.beginPath(); c.moveTo(-u * 0.24, 0); c.lineTo(u * 0.8, 0); c.moveTo(u * 0.5, 0); c.lineTo(u * 0.5, u * 0.24); c.moveTo(u * 0.72, 0); c.lineTo(u * 0.72, u * 0.3); c.stroke();
    c.lineWidth = u * 0.025; c.strokeStyle = k.belly; c.beginPath(); c.moveTo(-u * 0.2, -u * 0.02); c.lineTo(u * 0.76, -u * 0.02); c.stroke(); c.restore();
  } else {
    c.beginPath(); c.moveTo(-u * 0.55, u * 0.4); c.quadraticCurveTo(-u * 0.4, u * 0.2, -u * 0.36, -u * 0.2); c.quadraticCurveTo(-u * 0.3, -u * 0.62, 0, -u * 0.62); c.quadraticCurveTo(u * 0.3, -u * 0.62, u * 0.36, -u * 0.2); c.quadraticCurveTo(u * 0.4, u * 0.2, u * 0.55, u * 0.4); c.closePath();
    const g = c.createLinearGradient(-u * 0.5, 0, u * 0.5, 0); g.addColorStop(0, k.fin); g.addColorStop(0.4, k.belly); g.addColorStop(1, k.body); fill(g as unknown as string);
    oval(c, 0, -u * 0.68, u * 0.1, u * 0.1); fill(k.body); oval(c, Math.sin(t * 3) * u * 0.1, u * 0.46, u * 0.1, u * 0.1); fill(k.fin); c.fillStyle = '#4f7f5a'; oval(c, -u * 0.2, u * 0.05, u * 0.09, u * 0.05); c.fill(); oval(c, u * 0.18, -u * 0.2, u * 0.07, u * 0.04); c.fill();
  }
}

export type CreatureOpts = { face?: 1 | -1; rot?: number; silhouette?: string };
/** Draws a journal entry centred at (x, y), about `size` long. A silhouette is one flat colour, for unfound pages and shadows. */
export function creature(c: C, id: string, x: number, y: number, size: number, t = 0, o: CreatureOpts = {}) {
  const index = SPECIES.findIndex((sp) => sp.id === id); if (index < 0) return;
  c.save(); c.translate(x, y); c.scale(o.face ?? 1, 1); if (o.rot) c.rotate(o.rot);
  if (o.silhouette) {
    // Draw off to the side into a scratch layer so the whole shape takes one colour.
    const pad = Math.ceil(size * 0.75), s = scratch(pad * 2), sc = s.getContext('2d')!;
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalCompositeOperation = 'source-over'; sc.clearRect(0, 0, s.width, s.height); sc.translate(pad, pad);
    if (!PAINTED || !painted(sc, 'creatures', index, 0, 0, size, size)) drawn(sc, id, size, t, false);
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = o.silhouette; sc.fillRect(0, 0, s.width, s.height);
    c.drawImage(s, 0, 0, pad * 2, pad * 2, -pad, -pad, pad * 2, pad * 2);
  } else if (!PAINTED || !painted(c, 'creatures', index, 0, 0, size, size)) drawn(c, id, size, t);
  c.restore();
}
let scratchCanvas: HTMLCanvasElement | null = null;
function scratch(size: number) {
  scratchCanvas ??= document.createElement('canvas');
  if (scratchCanvas.width < size) { scratchCanvas.width = size; scratchCanvas.height = size; }
  return scratchCanvas;
}

/** Draws a prop centred at (x, y), about `size` across. */
export function prop(c: C, key: PropKey, x: number, y: number, size: number, t = 0) {
  if (PAINTED && painted(c, 'props', PROPS.indexOf(key), x, y, size, size)) return;
  const u = size / 2; c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = Math.max(1, size * 0.05); c.strokeStyle = 'rgba(16,12,24,.7)';
  if (key === 'bobber') {
    c.strokeStyle = '#d9d2c4'; c.beginPath(); c.moveTo(0, -u); c.lineTo(0, -u * 0.4); c.stroke(); c.strokeStyle = 'rgba(16,12,24,.7)';
    c.beginPath(); c.arc(0, 0, u * 0.55, Math.PI, 0); c.closePath(); c.fillStyle = '#e2533f'; c.fill(); c.stroke();
    c.beginPath(); c.arc(0, 0, u * 0.55, 0, Math.PI); c.closePath(); c.fillStyle = '#f7f1e3'; c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.7)'; oval(c, -u * 0.2, -u * 0.25, u * 0.12, u * 0.08, -0.6); c.fill();
  } else if (key === 'lily' || key === 'lily-flower') {
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, u, 0.35, Math.PI * 2 - 0.1); c.closePath(); c.save(); c.scale(1, 0.42);
    const g = c.createRadialGradient(-u * 0.2, -u * 0.2, u * 0.1, 0, 0, u); g.addColorStop(0, '#5f9a62'); g.addColorStop(1, '#2f6046'); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(12,30,26,.7)'; c.stroke();
    c.strokeStyle = 'rgba(180,220,170,.25)'; c.beginPath(); for (let i = 0; i < 6; i++) { c.moveTo(0, 0); c.lineTo(Math.cos(1 + i) * u * 0.85, Math.sin(1 + i) * u * 0.85); } c.stroke(); c.restore();
    if (key === 'lily-flower') { for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.12 + (0.76 * i) / 6); c.fillStyle = i % 2 ? '#f6dbe6' : '#fff4f8'; oval(c, Math.cos(a) * u * 0.22, -u * 0.12 + Math.sin(a) * u * 0.2, u * 0.26, u * 0.11, a); c.fill(); } c.fillStyle = '#f4cf5a'; oval(c, 0, -u * 0.16, u * 0.1, u * 0.07); c.fill(); }
  } else if (key === 'reed') {
    for (let i = 0; i < 5; i++) { const lean = (i - 2) * 0.16 + Math.sin(t * 1.3 + i) * 0.05, h = u * (1.6 + (i % 3) * 0.3); c.strokeStyle = i % 2 ? '#3d6a4a' : '#2e5540'; c.lineWidth = Math.max(1.2, size * 0.045); c.beginPath(); c.moveTo((i - 2) * u * 0.18, u); c.quadraticCurveTo((i - 2) * u * 0.18 + lean * u, u - h * 0.5, (i - 2) * u * 0.18 + lean * u * 2.4, u - h); c.stroke();
      if (i % 2 === 0) { c.strokeStyle = '#6b4a30'; c.lineWidth = Math.max(2.4, size * 0.1); c.beginPath(); c.moveTo((i - 2) * u * 0.18 + lean * u * 2.1, u - h * 0.9); c.lineTo((i - 2) * u * 0.18 + lean * u * 2.4, u - h * 1.08); c.stroke(); } }
  } else if (key === 'lantern') {
    const flick = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.7), g = c.createRadialGradient(0, 0, u * 0.1, 0, 0, u * 2.6); g.addColorStop(0, `rgba(255,214,120,${0.5 * flick})`); g.addColorStop(1, 'rgba(255,214,120,0)'); c.fillStyle = g; oval(c, 0, 0, u * 2.6, u * 2.6); c.fill();
    c.beginPath(); c.arc(0, -u * 0.75, u * 0.3, Math.PI, 0); c.stroke(); c.beginPath(); c.roundRect(-u * 0.42, -u * 0.62, u * 0.84, u * 1.3, u * 0.12); c.fillStyle = '#5a3d22'; c.fill(); c.stroke();
    c.beginPath(); c.roundRect(-u * 0.3, -u * 0.44, u * 0.6, u * 0.94, u * 0.08); c.fillStyle = `rgba(255,${200 + 30 * flick},${110 + 40 * flick},1)`; c.fill(); c.fillStyle = '#fff7d6'; oval(c, 0, u * 0.1, u * 0.1, u * 0.2 * flick); c.fill();
  } else {
    c.beginPath(); c.moveTo(0, u * 0.75); for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.08 + (0.84 * i) / 8), r = u * (i % 2 ? 0.8 : 0.92); c.lineTo(Math.cos(a) * r, u * 0.2 + Math.sin(a) * r); } c.closePath();
    const g = c.createLinearGradient(0, -u, 0, u); g.addColorStop(0, '#f6f3ff'); g.addColorStop(1, '#b9c2e6'); c.fillStyle = g; c.fill(); c.stroke();
    c.strokeStyle = 'rgba(90,100,150,.5)'; c.lineWidth = Math.max(0.8, size * 0.03); c.beginPath(); for (let i = 1; i < 8; i++) { const a = Math.PI * (1.08 + (0.84 * i) / 8); c.moveTo(0, u * 0.7); c.lineTo(Math.cos(a) * u * 0.8, u * 0.2 + Math.sin(a) * u * 0.8); } c.stroke();
  }
  c.restore();
}
