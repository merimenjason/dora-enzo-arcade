'use client';
// A note that explains whatever the mouse is resting on, or a finger is held on. Summit Shuffle has its own, richer
// version; this is the plain one the other games share. A page calls `useHoverNote()` once, spreads `tip(() => note)`
// onto anything worth explaining, and renders `view` somewhere in its tree.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type Note = {
  icon?: ReactNode; title: string; sub?: string; body?: string;
  /** Numbers worth a glance, as label and value. */
  stats?: [string, string][];
  /** Longer points, each with a word picked out in front. */
  lines?: { label: string; text: string }[];
  foot?: string;
};
type Box = { x: number; y: number; w: number; h: number };
type Shown = { at: Box; make: () => Note | null };
const boxOf = (el: Element): Box => { const q = el.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; };
const HOLD = 380;
type Own = Partial<Record<'onPointerEnter' | 'onPointerLeave' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel', (e: React.PointerEvent<HTMLElement>) => void>>;

const S: Record<string, CSSProperties> = {
  box: { position: 'fixed', left: 0, top: 0, visibility: 'hidden', zIndex: 80, pointerEvents: 'none', width: 'min(280px, calc(100vw - 16px))', padding: '11px 13px', borderRadius: 14, background: 'linear-gradient(#38456f, #242b48)', border: '1px solid #7483b4', boxShadow: '0 14px 26px rgba(4, 2, 12, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.14)', display: 'flex', flexDirection: 'column', gap: 7, textAlign: 'left', fontSize: 13, lineHeight: 1.42, color: '#e9ecff', fontWeight: 400, letterSpacing: 0, textTransform: 'none' },
  head: { display: 'flex', gap: 9, alignItems: 'center' },
  icon: { fontSize: 24, lineHeight: 1, flex: 'none', display: 'flex' },
  title: { display: 'block', fontSize: 15.5, fontWeight: 800, color: '#ffffff' },
  sub: { display: 'block', fontSize: 12, color: '#ffd98a' },
  body: { margin: 0, color: '#e9ecff', fontSize: 13 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(74px, 1fr))', gap: 5, margin: 0 },
  stat: { padding: '5px 7px', borderRadius: 8, background: 'rgba(10, 8, 24, 0.36)', display: 'flex', flexDirection: 'column' },
  statK: { fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#a9b4e0' },
  statV: { fontSize: 13.5, fontWeight: 800, color: '#ffffff' },
  line: { margin: 0, padding: '6px 9px', borderRadius: 9, background: 'rgba(10, 8, 24, 0.36)', color: '#d7dcf5', fontSize: 12.5 },
  label: { color: '#ffd98a', marginRight: 4 },
  foot: { margin: 0, fontSize: 12, fontStyle: 'italic', color: '#c3c9ea' },
};

export function useHoverNote() {
  const [shown, setShown] = useState<Shown | null>(null);
  const press = useRef({ timer: 0, held: false, x: 0, y: 0 }), ref = useRef<HTMLDivElement>(null);
  const note = shown ? shown.make() : null;

  useEffect(() => {
    const away = () => setShown(null);
    window.addEventListener('pointerdown', away, true); window.addEventListener('scroll', away, true); window.addEventListener('keydown', away, true); window.addEventListener('blur', away);
    return () => { window.removeEventListener('pointerdown', away, true); window.removeEventListener('scroll', away, true); window.removeEventListener('keydown', away, true); window.removeEventListener('blur', away); };
  }, []);
  // Above what it explains, or below when there is no room, and never off the screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shown) return;
    const vw = window.innerWidth, vh = window.innerHeight, w = el.offsetWidth, h = el.offsetHeight, a = shown.at, gap = 10, edge = 8;
    let y = a.y - h - gap;
    if (y < edge && a.y + a.h + gap + h <= vh - edge) y = a.y + a.h + gap;
    el.style.left = `${Math.max(edge, Math.min(vw - w - edge, a.x + a.w / 2 - w / 2))}px`; el.style.top = `${Math.max(edge, Math.min(vh - h - edge, y))}px`;
    el.style.visibility = 'visible';
  });

  /**
   * Handlers for one thing worth explaining. `make` runs on every render while the note is up, so its numbers stay
   * true. Pass the element's own pointer handlers as `own` and they still run, after the note's.
   */
  const tip = (make: () => Note | null, own: Own = {}) => {
    type E = React.PointerEvent<HTMLElement>;
    const p = press.current, lift = () => { window.clearTimeout(p.timer); if (p.held) setShown(null); };
    const mine = {
      onPointerEnter: (e: E) => { if (e.pointerType === 'mouse') setShown({ at: boxOf(e.currentTarget), make }); },
      onPointerLeave: (e: E) => { if (e.pointerType === 'mouse') setShown(null); },
      onPointerDown: (e: E) => {
        if (e.pointerType === 'mouse') return;
        const el = e.currentTarget;
        p.held = false; p.x = e.clientX; p.y = e.clientY;
        window.clearTimeout(p.timer);
        p.timer = window.setTimeout(() => { p.held = true; setShown({ at: boxOf(el), make }); }, HOLD);
      },
      onPointerMove: (e: E) => { if (e.pointerType !== 'mouse' && !p.held && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) window.clearTimeout(p.timer); },
      onPointerUp: lift, onPointerCancel: lift,
      // Letting go after a long look is not a tap.
      onClickCapture: (e: React.MouseEvent) => { if (p.held) { p.held = false; e.preventDefault(); e.stopPropagation(); } },
      onContextMenu: (e: React.MouseEvent) => { if (p.held) e.preventDefault(); },
    };
    const out = { ...mine } as Record<string, (e: never) => void>;
    for (const k of Object.keys(own) as (keyof Own)[]) { const a = (mine as Record<string, ((e: never) => void) | undefined>)[k], b = own[k] as ((e: never) => void) | undefined; if (b) out[k] = a ? (e: never) => { a(e); b(e); } : b; }
    return out as typeof mine;
  };

  const view = !note ? null : (
    <div ref={ref} role="tooltip" data-testid="hover-note" style={S.box}>
      <div style={S.head}>
        {note.icon !== undefined && <span style={S.icon} aria-hidden="true">{note.icon}</span>}
        <div><strong style={S.title}>{note.title}</strong>{note.sub && <small style={S.sub}>{note.sub}</small>}</div>
      </div>
      {note.body && <p style={S.body}>{note.body}</p>}
      {note.stats && note.stats.length > 0 && <div style={S.stats}>{note.stats.map(([k, v]) => <span key={k} style={S.stat}><span style={S.statK}>{k}</span><span style={S.statV}>{v}</span></span>)}</div>}
      {note.lines?.map((l) => <p key={l.label} style={S.line}><b style={S.label}>{l.label}</b>{l.text}</p>)}
      {note.foot && <p style={S.foot}>{note.foot}</p>}
    </div>
  );
  return { tip, view, hide: () => setShown(null) };
}
