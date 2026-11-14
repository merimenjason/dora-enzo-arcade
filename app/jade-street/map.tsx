'use client';
// Jade Street: the painted paper map. The real city (the painted ground and buildings from the scene) is drawn on
// parchment inside a red lacquer frame, each district lightly tinted and outlined, with painted fog clouds over the
// districts still locked, painted landmark icons, the district names on plaques, and painted pins for markets, safe
// houses, garages, side gigs, jobs, found lucky cats, painted murals and your own pin. Drag to pan, pinch or wheel to
// zoom; tap a pin for its name and a "Route here" button. Code draws only the tints, fog fallback and the route line.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DISTRICTS, DISTRICT_NAME, T, W, H, districtAt, type District } from '@/lib/jade-city';
import { available, safeOpen } from '@/lib/jade-save';
import { PEOPLE } from '@/lib/jade-story';
import { spr, artLoaded, type Scene } from '@/lib/jade-scene';
import type { Play } from './controller';
import { Sprite, Btn, ART } from './ui';
import './map.css';

type PinKind = 'job' | 'market' | 'safe' | 'garage' | 'gig' | 'cat' | 'mural' | 'pin' | 'spot';
type Pin = { kind: PinKind; name: string; sub?: string; x: number; y: number; key: string };
type View = { cx: number; cy: number; z: number };

const PIN_SPRITE: Record<PinKind, string> = {
  job: 'pin-job', market: 'pin-market', safe: 'pin-safe', garage: 'pin-garage', gig: 'pin-gig', cat: 'pin-cat', mural: 'pin-mural', pin: 'pin-star', spot: 'pin-star',
};
const LEGEND: [PinKind, string][] = [['job', 'Job'], ['market', 'Market'], ['safe', 'Safe house'], ['garage', 'Garage'], ['gig', 'Side gig'], ['cat', 'Lucky cat found'], ['mural', 'Mural painted'], ['pin', 'Your pin']];
const TINT: Record<District, [number, number, number]> = { market: [255, 128, 70], temple: [90, 200, 120], canal: [60, 200, 215], arcade: [225, 90, 220], docks: [80, 125, 255] };
const CENTRE: Record<District, [number, number]> = { market: [22, 58], temple: [23, 16], canal: [58, 31], arcade: [97, 34], docks: [84, 76] };
const dName = (d: District) => DISTRICT_NAME[d].replace(/^the /, 'The ');
const MW = W * T, MH = H * T;

// ── the painted city at 16 px a tile, the district tint and the district borders: built once per scene
const PAPER = new WeakMap<Scene, HTMLCanvasElement>();
function paperMap(scene: Scene): HTMLCanvasElement {
  const have = PAPER.get(scene); if (have) return have;
  const k = 16, c = document.createElement('canvas'); c.width = W * k; c.height = H * k;
  const x = c.getContext('2d')!; x.setTransform(k / T, 0, 0, k / T, 0, 0);
  scene.paintGround(x, 0, 0, W, H, true);
  if (artLoaded()) PAPER.set(scene, c); // not loaded yet: build again next time rather than keep flat blocks
  return c;
}
let TINTS: HTMLCanvasElement | null = null;
function tints(): HTMLCanvasElement {
  if (TINTS) return TINTS;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d')!; const im = x.createImageData(W, H);
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) { const [r, g, b] = TINT[districtAt(tx, ty)]; const i = (ty * W + tx) * 4; im.data[i] = r; im.data[i + 1] = g; im.data[i + 2] = b; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0); TINTS = c; return c;
}
let BORDERS: [number, number, number, number][] | null = null;
function borders() {
  if (BORDERS) return BORDERS;
  const out: [number, number, number, number][] = [];
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const d = districtAt(tx, ty);
    if (tx + 1 < W && districtAt(tx + 1, ty) !== d) out.push([(tx + 1) * T, ty * T, (tx + 1) * T, (ty + 1) * T]);
    if (ty + 1 < H && districtAt(tx, ty + 1) !== d) out.push([tx * T, (ty + 1) * T, (tx + 1) * T, (ty + 1) * T]);
  }
  BORDERS = out; return out;
}
let PAPER_IMG: HTMLImageElement | null = null;
function paperImg() { if (!PAPER_IMG && typeof Image !== 'undefined') { PAPER_IMG = new Image(); PAPER_IMG.src = `${ART}bg-map-paper.webp`; } return PAPER_IMG; }

/** painted landmark icons and where they stand */
function landmarks(play: Play): [string, number, number][] {
  const c = play.w.c, P = c.places; const out: [string, number, number][] = [];
  const at = (n: string, id: string, dx = 0, dy = 0) => { const p = P[id]; if (p) out.push([n, p.x + dx, p.y + dy]); };
  at('mi-temple', 'temple-top'); at('mi-pagoda', 'pagoda');
  const crane = c.props.find(p => p.sprite === 'crane'); if (crane) out.push(['mi-crane', crane.x, crane.y]); else at('mi-crane', 'mk-docks', 3 * T, 0);
  at('mi-arcade', 'gizmo', 0, -2 * T);
  const br = c.decals.find(d => d.sprite === 'd-bridge-stone'); if (br) out.push(['mi-bridge', br.x, br.y]);
  out.push(['mi-lighthouse', 115.5 * T, 85.5 * T]);
  if (P.ferry) at('mi-ferry', 'ferry'); else at('mi-ferry', 'pier-end');
  const hall = c.buildings.find(b => b.sprite === 'lm2-hall'); if (hall) out.push(['mi-hall', (hall.x + hall.w / 2) * T, (hall.y + hall.h / 2) * T]);
  return out;
}

function pinsOf(play: Play): Pin[] {
  const w = play.w, out: Pin[] = [];
  const open = (x: number, y: number) => w.open.has(districtAt(Math.floor(x / T), Math.floor(y / T)));
  const add = (p: Pin) => { if (open(p.x, p.y)) out.push(p); };
  for (const [id, pl] of Object.entries(w.c.places)) {
    if (pl.kind === 'market') add({ kind: 'market', name: pl.name ?? dName(pl.d), sub: 'Buy low, sell high', x: pl.x, y: pl.y, key: id });
    else if (pl.kind === 'safe') add({ kind: 'safe', name: pl.name ?? 'Safe house', sub: safeOpen(w.s, id) ? 'Yours: sleep, swap and stash here' : 'For sale', x: pl.x, y: pl.y, key: id });
    else if (pl.kind === 'garage') add({ kind: 'garage', name: pl.name ?? 'Garage', sub: 'Upgrades and paint', x: pl.x, y: pl.y, key: id });
  }
  for (const g of w.gigs()) add({ kind: 'gig', name: g.label, x: g.x, y: g.y, key: 'gig-' + (g.id ?? g.label) });
  if (w.run) { const o = w.objective(); if (o) out.push({ kind: 'job', name: w.run.label || 'Current job', sub: 'Your job’s next stop', x: o[0], y: o[1], key: 'job-now' }); }
  else for (const m of available(w.s)) { const pl = w.c.places[m.at]; if (pl) add({ kind: 'job', name: m.title, sub: `Job from ${PEOPLE[m.giver]?.name ?? 'a friend'}`, x: pl.x, y: pl.y, key: 'job-' + m.id }); }
  w.s.cats.forEach(i => { const ct = w.c.cats[i]; if (ct) add({ kind: 'cat', name: 'Lucky cat', sub: 'Found', x: ct.x, y: ct.y, key: 'cat-' + i }); });
  for (const m of w.c.murals) if (w.s.murals.includes(m.id)) add({ kind: 'mural', name: 'Mural', sub: 'Painted', x: m.x, y: m.y, key: m.id });
  if (w.waypoint) out.push({ kind: 'pin', name: 'Your pin', sub: 'The gold line leads here', x: w.waypoint[0], y: w.waypoint[1], key: 'waypoint' });
  return out;
}

export function PaintedMap({ play, onClose }: { play: Play; onClose: () => void }) {
  const w = play.w;
  const box = useRef<HTMLDivElement>(null); const cv = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ cx: w.p.x, cy: w.p.y, z: 0 });
  const vref = useRef(view); vref.current = view;
  const [sel, setSel] = useState<Pin | null>(null);
  const [legend, setLegend] = useState(() => typeof window === 'undefined' || (window.innerWidth > 720 && window.innerHeight > 520));
  const [, force] = useState(0);
  const lms = useMemo(() => landmarks(play), [play]);
  const pins = pinsOf(play);

  const fitZ = size.w ? Math.min(size.w / MW, size.h / MH) : 0.1, fillZ = size.w ? Math.max(size.w / MW, size.h / MH) : 0.1;
  const minZ = fitZ, maxZ = 0.7;
  const clampV = useCallback((v: View): View => {
    if (!size.w) return v;
    const z = Math.max(minZ, Math.min(maxZ, v.z || Math.min(maxZ, Math.max(fillZ, fitZ * 1.8))));
    const hw = size.w / 2 / z, hh = size.h / 2 / z;
    const cx = hw * 2 >= MW ? MW / 2 : Math.max(hw, Math.min(MW - hw, v.cx));
    const cy = hh * 2 >= MH ? MH / 2 : Math.max(hh, Math.min(MH - hh, v.cy));
    return { cx, cy, z };
  }, [size.w, size.h, minZ, fillZ, fitZ]);

  // size and the starting view: centred on the player, filling the screen
  useEffect(() => {
    const el = box.current!; const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setSize({ w: Math.round(r.width), h: Math.round(r.height) }); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => { setView(v => clampV(v)); }, [clampV]);

  // the canvas: map, paper, tints, borders, landmarks, fog and the route, redrawn every frame (fog drifts)
  useEffect(() => {
    const c = cv.current!; const x = c.getContext('2d')!; let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const v = vref.current; if (!size.w || !v.z) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(size.w * dpr) || c.height !== Math.round(size.h * dpr)) { c.width = Math.round(size.w * dpr); c.height = Math.round(size.h * dpr); }
      const t = now / 1000, s = dpr * v.z;
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
      x.setTransform(s, 0, 0, s, dpr * size.w / 2 - v.cx * s, dpr * size.h / 2 - v.cy * s);
      x.imageSmoothingEnabled = true;
      x.drawImage(paperMap(play.scene), 0, 0, MW, MH);
      // a warm lift so the night-painted city reads as ink and colour on parchment
      x.globalCompositeOperation = 'screen'; x.fillStyle = 'rgba(255,236,200,.16)'; x.fillRect(0, 0, MW, MH);
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 0.13; x.imageSmoothingEnabled = false; x.drawImage(tints(), 0, 0, MW, MH); x.imageSmoothingEnabled = true; x.globalAlpha = 1;
      const pi = paperImg();
      if (pi && pi.complete && pi.naturalWidth) { x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.6; x.drawImage(pi, 0, 0, MW, MH); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
      // district borders: a dashed ink line
      x.strokeStyle = 'rgba(70,35,15,.75)'; x.lineWidth = Math.max(10, 2.5 / v.z); x.setLineDash([40, 26]); x.lineCap = 'round';
      x.beginPath(); for (const [a, b, c2, d] of borders()) { x.moveTo(a, b); x.lineTo(c2, d); } x.stroke(); x.setLineDash([]);
      // landmarks (only where the fog has lifted)
      const iz = Math.max(110, Math.min(260, 48 / v.z));
      for (const [n, lx, ly] of lms) if (w.open.has(districtAt(Math.floor(lx / T), Math.floor(ly / T)))) spr(x, n, lx, ly, { w: iz, anchor: 'center' });
      // fog over the locked districts: painted cloud banks drifting slowly (soft glow if the clouds are missing)
      for (const d of DISTRICTS) {
        if (w.open.has(d)) continue;
        x.save(); x.beginPath();
        for (let ty = 0; ty < H; ty += 2) { let tx0 = -1; for (let tx = 0; tx <= W; tx++) { const inD = tx < W && districtAt(tx, ty) === d; if (inD && tx0 < 0) tx0 = tx; if (!inD && tx0 >= 0) { x.rect(tx0 * T, ty * T, (tx - tx0) * T, 2 * T); tx0 = -1; } } }
        x.clip();
        x.fillStyle = 'rgba(62,52,98,.62)'; x.fillRect(0, 0, MW, MH);
        let k = 0;
        for (let ty = 2; ty < H; ty += 11) for (let tx = 1; tx < W; tx += 15) {
          const ox = tx + ((ty * 7) % 9) - 4; if (districtAt(Math.max(0, Math.min(W - 1, ox)), Math.min(H - 1, ty)) !== d) continue;
          const fx = ox * T + Math.sin(t * 0.15 + k) * 90, fy = ty * T + Math.cos(t * 0.12 + k * 1.7) * 50;
          if (!spr(x, `fog-${(k % 6) + 1}`, fx, fy, { w: 17 * T, anchor: 'center', alpha: 0.92 })) {
            const g = x.createRadialGradient(fx, fy, 0, fx, fy, 8 * T); g.addColorStop(0, 'rgba(220,210,245,.55)'); g.addColorStop(1, 'rgba(220,210,245,0)'); x.fillStyle = g; x.fillRect(fx - 8 * T, fy - 8 * T, 16 * T, 16 * T);
          }
          k++;
        }
        x.restore();
      }
      // the gold route line
      if (w.route.length > 1 && (w.assist || w.run || w.waypoint)) {
        x.lineCap = 'round'; x.lineJoin = 'round';
        x.beginPath(); x.moveTo(w.p.x, w.p.y); for (const [rx, ry] of w.route.slice(1)) x.lineTo(rx, ry);
        x.strokeStyle = 'rgba(120,60,10,.55)'; x.lineWidth = Math.max(26, 9 / v.z); x.stroke();
        x.setLineDash([Math.max(40, 14 / v.z), Math.max(30, 10 / v.z)]); x.lineDashOffset = -t * 120;
        x.strokeStyle = 'rgba(255,214,90,.98)'; x.lineWidth = Math.max(14, 5 / v.z); x.stroke(); x.setLineDash([]);
      }
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, [play, w, size.w, size.h, lms]);

  // ── panning and zooming: one pointer drags, two pinch, the wheel zooms about the cursor
  const ptrs = useRef(new Map<number, [number, number]>());
  const gest = useRef<{ x: number; y: number; v: View; d?: number; moved: boolean }>({ x: 0, y: 0, v: view, moved: false });
  const toWorld = (sx: number, sy: number, v = vref.current): [number, number] => [v.cx + (sx - size.w / 2) / v.z, v.cy + (sy - size.h / 2) / v.z];
  const local = (e: { clientX: number; clientY: number }): [number, number] => { const r = box.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const zoomAt = (sx: number, sy: number, z: number, base = vref.current) => {
    const [wx, wy] = [base.cx + (sx - size.w / 2) / base.z, base.cy + (sy - size.h / 2) / base.z];
    const nz = Math.max(minZ, Math.min(maxZ, z));
    setView(clampV({ z: nz, cx: wx - (sx - size.w / 2) / nz, cy: wy - (sy - size.h / 2) / nz }));
  };
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.jade-pmap-ui')) return;
    ptrs.current.set(e.pointerId, local(e));
    const ps = [...ptrs.current.values()];
    if (ps.length === 1) gest.current = { x: ps[0][0], y: ps[0][1], v: vref.current, moved: false };
    else if (ps.length === 2) gest.current = { x: (ps[0][0] + ps[1][0]) / 2, y: (ps[0][1] + ps[1][1]) / 2, v: vref.current, d: Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]) || 1, moved: true };
  };
  const move = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, local(e));
    const ps = [...ptrs.current.values()], g = gest.current;
    if (ps.length === 1) {
      const dx = ps[0][0] - g.x, dy = ps[0][1] - g.y;
      if (!g.moved && Math.hypot(dx, dy) < 8) return;
      g.moved = true; setView(clampV({ z: g.v.z, cx: g.v.cx - dx / g.v.z, cy: g.v.cy - dy / g.v.z }));
    } else if (ps.length >= 2 && g.d) {
      const d = Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]);
      const mx = (ps[0][0] + ps[1][0]) / 2, my = (ps[0][1] + ps[1][1]) / 2;
      const nz = Math.max(minZ, Math.min(maxZ, g.v.z * d / g.d));
      const [wx, wy] = [g.v.cx + (g.x - size.w / 2) / g.v.z, g.v.cy + (g.y - size.h / 2) / g.v.z];
      setView(clampV({ z: nz, cx: wx - (mx - size.w / 2) / nz, cy: wy - (my - size.h / 2) / nz }));
    }
  };
  const up = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.delete(e.pointerId);
    const g = gest.current;
    if (ptrs.current.size === 1) { const [p] = [...ptrs.current.values()]; gest.current = { x: p[0], y: p[1], v: vref.current, moved: true }; return; }
    if (ptrs.current.size || g.moved) return;
    // a tap: the nearest pin under the finger, or (off a job) a spot on the map
    const [sx, sy] = local(e);
    const tgt = (e.target as HTMLElement).closest('[data-testid="jade-map-pin"]') as HTMLElement | null;
    const hit = tgt ? pins.find(p => p.key === tgt.dataset.key) : null;
    if (hit) { setSel(hit); return; }
    const [wx, wy] = toWorld(sx, sy);
    if (wx < 0 || wy < 0 || wx > MW || wy > MH) { setSel(null); return; }
    if (!w.open.has(districtAt(Math.floor(wx / T), Math.floor(wy / T)))) { setSel({ kind: 'spot', name: `${dName(districtAt(Math.floor(wx / T), Math.floor(wy / T)))} is in the fog`, sub: 'Follow the story to open it', x: wx, y: wy, key: 'fog' }); return; }
    setSel({ kind: 'spot', name: 'Marked spot', sub: dName(districtAt(Math.floor(wx / T), Math.floor(wy / T))), x: wx, y: wy, key: 'spot' });
  };
  useEffect(() => {
    const el = box.current!;
    const wheel = (e: WheelEvent) => { e.preventDefault(); const [sx, sy] = local(e); zoomAt(sx, sy, vref.current.z * Math.exp(-e.deltaY * 0.0015)); };
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel);
  });
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === '+' || e.key === '=') zoomAt(size.w / 2, size.h / 2, vref.current.z * 1.35); else if (e.key === '-' || e.key === '_') zoomAt(size.w / 2, size.h / 2, vref.current.z / 1.35); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const route = (p: Pin) => { w.waypoint = [p.x, p.y]; w.routeT = 0; w.updateRoute(); play.bump(); onClose(); };
  const clear = () => { w.waypoint = null; w.route = []; w.updateRoute(); setSel(null); force(n => n + 1); play.bump(); };
  const scr = (wx: number, wy: number, v = view): [number, number] => [size.w / 2 + (wx - v.cx) * v.z, size.h / 2 + (wy - v.cy) * v.z];
  const pinSize = Math.round(Math.max(26, Math.min(44, view.z * 90)));
  const small = (k: PinKind) => k === 'cat' || k === 'mural';
  const order: PinKind[] = ['cat', 'mural', 'gig', 'garage', 'safe', 'market', 'spot', 'pin', 'job'];
  const shown = [...pins].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.y - b.y);
  const [hx, hy] = scr(w.p.x, w.p.y);
  const plaque = Math.round(Math.max(12, Math.min(19, view.z * 60)));
  let pop: [number, number] | null = null;
  if (sel) { const [a, b] = scr(sel.x, sel.y); pop = [Math.max(8, Math.min(size.w - 228, a - 110)), b - pinSize - 8 > 140 ? b - pinSize - 8 : b + 18]; }

  return (
    <div className="jade-pmap-back" data-testid="jade-map" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="jade-pmap" role="dialog" aria-label="City map" data-testid="map" data-zoom={view.z.toFixed(3)} data-cx={Math.round(view.cx)} data-cy={Math.round(view.cy)}>
        <div className="jade-pmap-paper" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={e => { ptrs.current.delete(e.pointerId); }}>
          <canvas ref={cv} className="jade-pmap-cv" data-testid="map-canvas" />
          {view.z > 0 && DISTRICTS.map(d => {
            const [a, b] = scr(CENTRE[d][0] * T, CENTRE[d][1] * T); const locked = !w.open.has(d);
            return <div key={d} className={'jade-pmap-plaque' + (locked ? ' locked' : '')} style={{ left: a, top: b, fontSize: plaque }} data-testid="jade-map-plaque">{dName(d)}{locked && <small>in the fog</small>}</div>;
          })}
          {view.z > 0 && shown.map(p => {
            const [a, b] = scr(p.x, p.y); const sz = small(p.kind) ? Math.round(pinSize * 0.72) : pinSize;
            if (a < -40 || b < -40 || a > size.w + 40 || b > size.h + 60) return null;
            return (
              <button key={p.key} type="button" className={'jade-pmap-pin k-' + p.kind + (sel?.key === p.key ? ' on' : '')} style={{ left: a, top: b }} aria-label={p.name}
                data-testid="jade-map-pin" data-kind={p.kind} data-name={p.name} data-key={p.key} onClick={e => { e.stopPropagation(); if (!gest.current.moved) setSel(p); }}>
                <Sprite name={PIN_SPRITE[p.kind]} h={sz} w={sz} />
              </button>
            );
          })}
          {view.z > 0 && <div className="jade-pmap-me" style={{ left: hx, top: hy }} aria-label="You are here"><Sprite name="ui-ring" h={pinSize + 6} w={pinSize + 6} cls="ring" /><Sprite name={`face-${w.s.hero}`} h={pinSize - 6} w={pinSize - 6} cls="face" /></div>}
          {sel && pop && (
            <div className="jade-pmap-pop jade-pmap-ui" style={{ left: pop[0], top: pop[1] }} data-testid="jade-map-popup" onPointerDown={e => e.stopPropagation()}>
              <div className="jade-pmap-pop-head"><Sprite name={PIN_SPRITE[sel.kind]} h={30} w={30} /><div><b>{sel.name}</b>{sel.sub && <span>{sel.sub}</span>}</div></div>
              {w.run ? <p>On a job: follow the job’s gold line.</p> : sel.key === 'fog' ? null : (
                <div className="jade-pmap-pop-btns">
                  {sel.kind !== 'pin' && <Btn kind="jade" testid="jade-map-route" onClick={() => route(sel)}>Route here</Btn>}
                  {w.waypoint && <Btn kind="red" testid="clear-pin" onClick={clear}>Clear route</Btn>}
                </div>
              )}
              <button type="button" className="jade-pmap-pop-x" aria-label="Close the card" onClick={() => setSel(null)}>×</button>
            </div>
          )}
        </div>
        <div className="jade-pmap-frame" aria-hidden />
        <div className="jade-pmap-title jade-pmap-ui"><h2>City map</h2></div>
        <button type="button" className="jade-pmap-close jade-pmap-ui" aria-label="Close" data-testid="close" onClick={onClose}>×</button>
        <div className="jade-pmap-zoom jade-pmap-ui">
          <Btn kind="jade" testid="jade-map-zoom-in" title="Zoom in" onClick={() => zoomAt(size.w / 2, size.h / 2, view.z * 1.4)}>+</Btn>
          <Btn kind="jade" testid="jade-map-zoom-out" title="Zoom out" onClick={() => zoomAt(size.w / 2, size.h / 2, view.z / 1.4)}>−</Btn>
          <Btn kind="red" testid="jade-map-me" title="Centre on me" onClick={() => setView(clampV({ ...view, cx: w.p.x, cy: w.p.y }))}>Me</Btn>
        </div>
        <div className={'jade-pmap-legend jade-pmap-ui' + (legend ? ' open' : '')} data-testid="jade-map-legend">
          <button type="button" className="jade-pmap-legend-tog" aria-expanded={legend} data-testid="jade-map-legend-toggle" onClick={() => setLegend(o => !o)}>{legend ? 'Hide key' : 'Map key'}</button>
          {legend && <>
            <ul>{LEGEND.map(([k, label]) => <li key={k}><Sprite name={PIN_SPRITE[k]} h={24} w={24} />{label}</li>)}</ul>
            <p>{w.run ? 'Drag to look around. Your job’s route is shown.' : 'Drag to move, pinch or scroll to zoom, tap a pin to route there.'}</p>
            {w.waypoint && !sel && <button type="button" className="jade-pmap-link" data-testid="clear-pin" onClick={clear}>Clear route</button>}
          </>}
        </div>
      </div>
    </div>
  );
}
