// A gentle, mostly wordless tutorial for the first turns: one glowing ring and a pointing paw on one thing at a time,
// with a one- or two-word label. Each step ends when the player does the thing; "Skip" ends the tutorial.
// The ring, label and skip button are rendered by the page (.tut, .tutlab, .tutskip); this class places them.
import { hexCenter } from '@/lib/highburrow-scene';
import type { Cmd } from '@/lib/highburrow-game';
import { store } from './dom';
import type { Highburrow } from './controller';

const KEY = 'highburrow-tut';
interface Step { label: string; target: (a: Highburrow) => Element | [number, number] | null; done: (a: Highburrow, c?: Cmd) => boolean; when?: (a: Highburrow) => boolean }
const q = (s: string) => document.querySelector(s);
const STEPS: Step[] = [
  { label: 'Explore', target: () => q('#unit [data-act="explore"]'), done: (a, c) => c?.k === 'explore' || (c?.k === 'move' && a.g.unit(c.unit)?.kind === 'dora') },
  { label: 'Your village', target: a => { const v = a.g.s.villages[0]; return [v.q, v.r]; }, done: a => a.modal === 'village' },
  { label: 'Drag to a field', when: a => a.modal === 'village', target: () => q('.village .room[data-job="builder"] .fig') ?? q('.village .fig'), done: (a, c) => c?.k === 'assign' || a.modal !== 'village' },
  { label: 'Close', when: a => a.modal === 'village', target: () => q('.village .xbtn'), done: a => a.modal !== 'village' },
  { label: 'End turn', when: a => !a.modal, target: () => q('#end'), done: (_a, c) => c?.k === 'end' },
  { label: 'Next', when: a => a.modal === 'summary', target: () => q('.summary .wbtn.red'), done: a => a.modal !== 'summary' },
  { label: 'Enzo’s tip', when: a => !a.modal, target: () => q('#advice .wbtn.red'), done: (_a, c) => !!c && c.k !== 'end' },
  { label: 'Hover any number', when: a => !a.modal && a.g.s.turn >= 2, target: () => q('#top .warmth'), done: a => a.g.s.turn >= 4 },
];

export class Tutorial {
  step = 0;
  constructor(private app: Highburrow) { const v = Number(store(KEY) ?? 0); this.step = isNaN(v) ? 0 : v; }
  reset() { this.step = 0; this.save(); }
  skipAll() { this.step = STEPS.length; this.save(); this.place(); }
  private save() { store(KEY, String(this.step)); }
  /** advance when the current step is done (called after every command and modal change) */
  check(c?: Cmd) {
    let guard = 0;
    while (this.step < STEPS.length && guard++ < 3) {
      const s = STEPS[this.step];
      if (s.done(this.app, c)) { this.step++; this.save(); c = undefined; continue; }
      break;
    }
    if (this.app.g?.s.turn > 6 && this.step < STEPS.length) { this.step = STEPS.length; this.save(); }
    this.place();
  }
  place() {
    const ring = q('.hb-shell .tut') as HTMLElement | null, label = q('.hb-shell .tutlab') as HTMLElement | null, skip = q('.hb-shell .tutskip') as HTMLElement | null;
    if (!ring || !label || !skip) return;
    const s = STEPS[this.step];
    const hide = () => { ring.classList.remove('on'); label.classList.remove('on'); skip.classList.toggle('on', this.step < STEPS.length && !!this.app.g && this.app.modal !== 'title'); };
    if (!s || !this.app.g || this.app.modal === 'title' || (s.when && !s.when(this.app))) {
      // a step that waits on a modal that was closed: move on rather than get stuck
      if (s && s.when && this.step >= 2 && this.step <= 3 && this.app.modal !== 'village' && this.app.modal !== 'title') { this.step = 4; this.save(); }
      if (s && this.step === 5 && this.app.modal === '' && this.app.g?.s.turn >= 2) { this.step = 6; this.save(); }
      return hide();
    }
    const t = s.target(this.app); if (!t) return hide();
    let x: number, y: number, r: number;
    if (Array.isArray(t)) {
      const p = hexCenter(t[0], t[1]); const sp = this.app.scene.toScreen(p.x, p.y - 20);
      const cr = this.app.cv.getBoundingClientRect(); x = sp.x + cr.left; y = sp.y + cr.top; r = 48 * this.app.scene.view.z;
    } else { const b = t.getBoundingClientRect(); if (!b.width) return hide(); x = b.left + b.width / 2; y = b.top + b.height / 2; r = Math.max(b.width, b.height) / 2 + 8; }
    ring.style.cssText = `left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px`;
    ring.classList.add('on');
    label.textContent = s.label; label.classList.add('on');
    // try spots around the ring and keep the first that stays on screen and covers no button
    const lw = label.offsetWidth, lh = label.offsetHeight || 32;
    const clamp = (lx: number) => Math.max(6, Math.min(innerWidth - lw - 6, lx));
    const panel = !Array.isArray(t) ? t.closest('#unit, #side') : null;
    const pr = panel?.getBoundingClientRect();
    const spots: [number, number][] = [
      ...(pr ? [[clamp(x - lw / 2), pr.top - lh - 8] as [number, number]] : []),
      [clamp(x - lw / 2), y + r + 10], [clamp(x - lw / 2), y - r - lh - 10],
      [x + r + 14, y - lh / 2], [x - r - lw - 14, y - lh / 2],
      [clamp(x - lw / 2), y + r + 70], [clamp(x - lw / 2), y - r - lh - 70],
    ];
    const blockers = [...document.querySelectorAll<HTMLElement>('.hb-shell button, .hb-shell .act, #top, #advice, #unit, .hb-shell .rtag, .hb-shell .tlabel, .hb-shell .fig')]
      .filter(b => b !== skip && b.offsetParent !== null).map(b => b.getBoundingClientRect());
    const fits = ([lx, ly]: [number, number]) => lx >= 4 && ly >= 4 && lx + lw <= innerWidth - 4 && ly + lh <= innerHeight - 4
      && !blockers.some(b => lx < b.right && lx + lw > b.left && ly < b.bottom && ly + lh > b.top);
    const best = spots.find(fits) ?? spots.find(([lx, ly]) => lx >= 4 && ly >= 4 && lx + lw <= innerWidth && ly + lh <= innerHeight) ?? spots[0];
    label.style.left = `${best[0]}px`; label.style.top = `${best[1]}px`;
    skip.classList.add('on');
  }
}
