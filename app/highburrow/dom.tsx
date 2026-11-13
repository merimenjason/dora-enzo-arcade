// Highburrow UI helpers: atlas sprites as CSS backgrounds (a React component and a style builder), the signed-parts
// tooltip markup, one tooltip system that works with hover and tap (any element with data-tip explains itself), and
// localStorage wrapped in try/catch.
import type { CSSProperties } from 'react';
import { FRAMES, ATLASES, ATLAS_SIZE } from '@/lib/highburrow-art';
import type { Part } from '@/lib/highburrow-game';

export const ART = '/art/highburrow/';

/** the CSS for a sprite from an atlas, fitted to height h (or width w) */
export function spriteStyle(name: string, h: number, flip = false, w?: number): CSSProperties | null {
  const f = FRAMES[name]; if (!f) return null;
  const atlas = ATLASES[f[0]]; const [aw, ah] = ATLAS_SIZE[atlas] ?? [2048, 1024];
  const k = w ? w / f[3] : h / f[4];
  return {
    width: `${f[3] * k}px`, height: `${f[4] * k}px`, backgroundImage: `url(${ART}${atlas}.webp)`,
    backgroundSize: `${aw * k}px ${ah * k}px`, backgroundPosition: `${-f[1] * k}px ${-f[2] * k}px`, transform: flip ? 'scaleX(-1)' : undefined,
  };
}
type SprProps = { name: string; h: number; cls?: string; flip?: boolean; w?: number; tip?: string; style?: CSSProperties } & Omit<React.HTMLAttributes<HTMLDivElement>, 'style'>;
export function Sprite({ name, h, cls = '', flip = false, w, tip, style, ...rest }: SprProps) {
  const st = spriteStyle(name, h, flip, w);
  return <div className={'spr ' + cls} data-spr={name} data-missing={st ? undefined : name} data-tip={tip} style={{ ...(st ?? {}), ...style }} {...rest} />;
}
export const Icon = ({ name, size = 28, cls = '' }: { name: string; size?: number; cls?: string }) => <Sprite name={'i-' + name} h={size} cls={'ico ' + cls} />;

/** tooltip HTML from a list of signed parts, ending with the total */
export function partsHtml(title: string, parts: Part[], total?: string, note = '') {
  const rows = parts.map(p => `<div class="tr"><span>${p.label}</span><b class="${p.n < 0 ? 'neg' : 'pos'}">${p.n > 0 ? '+' : ''}${p.n}</b></div>`).join('');
  return `<div class="tt">${title}</div>${rows || '<div class="tr muted">Nothing yet</div>'}${total ? `<div class="tr tot"><span>Total</span><b>${total}</b></div>` : ''}${note ? `<div class="tn">${note}</div>` : ''}`;
}

// ── tooltips: the tip element is rendered by the page; this module shows it next to whatever has data-tip
let tipEl: HTMLDivElement | null = null; let tipFor: Element | null = null; let tipTimer = 0;
export function initTips(el: HTMLDivElement) {
  tipEl = el;
  const over = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const t = (e.target as Element).closest?.('[data-tip]'); if (t) show(t); else hideTip();
  };
  const down = (e: PointerEvent) => {
    const t = (e.target as Element).closest?.('[data-tip]');
    if (e.pointerType !== 'mouse' && t && !t.closest('button')) { show(t); clearTimeout(tipTimer); tipTimer = window.setTimeout(hideTip, 4000); }
    else if (!t) hideTip();
  };
  document.addEventListener('pointerover', over);
  document.addEventListener('pointerdown', down, true);
  return () => { document.removeEventListener('pointerover', over); document.removeEventListener('pointerdown', down, true); clearTimeout(tipTimer); tipEl = null; tipFor = null; };
}
function show(t: Element) {
  if (!tipEl) return; tipFor = t;
  tipEl.innerHTML = (t as HTMLElement).dataset.tip!; tipEl.classList.add('on');
  const r = t.getBoundingClientRect(); const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 8;
  if (y + th > innerHeight - 6) y = r.top - th - 8;
  x = Math.max(6, Math.min(innerWidth - tw - 6, x)); y = Math.max(6, y);
  tipEl.style.left = `${x}px`; tipEl.style.top = `${y}px`;
}
export function hideTip() { tipEl?.classList.remove('on'); tipFor = null; }
export function refreshTip() { if (tipFor && document.contains(tipFor)) show(tipFor); else hideTip(); }

export function store(key: string, val?: string): string | null {
  try { if (val === undefined) return localStorage.getItem(key); if (val === '') localStorage.removeItem(key); else localStorage.setItem(key, val); } catch { /* private mode */ }
  return null;
}
export const small = () => innerWidth < 720 || innerHeight < 460;
