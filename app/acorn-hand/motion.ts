/* oxlint-disable react/react-compiler -- A ticker sets state from an animation frame by design. */
// Acorn Hand's motion: small helpers on the Web Animations API. Nothing here changes game state or makes anything
// wait, so the game plays the same with motion off; every helper returns at once when motion is off.
import { useEffect, useRef, useState } from 'react';

export type Box = { x: number; y: number; w: number; h: number };
let on = true;
export const setMotion = (m: boolean) => { on = m; };
export const motionOn = () => on && typeof Element !== 'undefined' && 'animate' in Element.prototype;
const box = (el: Element): Box => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
export const boxOf = (el: Element | null) => (el ? box(el) : null);
const host = () => document.querySelector('.ah-shell') ?? document.body;
const SPRING = 'cubic-bezier(.2,1.3,.4,1)';

/** Where every element carrying `attr` under `root` is now, keyed by the attribute's value. */
export function remember(root: ParentNode | null, attr = 'data-card-id'): Map<string, Box> {
  const out = new Map<string, Box>();
  if (!root || !motionOn()) return out;
  root.querySelectorAll(`[${attr}]`).forEach((el) => out.set(el.getAttribute(attr)!, box(el)));
  return out;
}

/** Move each element from where it was to where it is; ones that were nowhere fly in from `origin`, if there is one. */
export function settle(root: ParentNode | null, from: Map<string, Box>, origin: Box | null, opts: { attr?: string; flipNew?: boolean } = {}) {
  if (!root || !motionOn()) return;
  const attr = opts.attr ?? 'data-card-id';
  let fresh = 0;
  root.querySelectorAll(`[${attr}]`).forEach((el) => {
    const now = box(el), was = from.get(el.getAttribute(attr)!), start = was ?? origin;
    if (!start || !now.w) return;
    const dx = start.x + start.w / 2 - (now.x + now.w / 2), dy = start.y + start.h / 2 - (now.y + now.h / 2), s = start.w / now.w;
    if (was && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    const delay = was ? 0 : 50 * fresh++;
    el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: 'none' }], { duration: was ? 220 : 320, delay, easing: SPRING, fill: 'backwards' });
    if (!was && opts.flipNew) flip(el, delay);
  });
}

/** Turn a card over: its `.ah-cardback` shows for the first half, its face for the second. */
export function flip(el: Element, delay = 0) {
  if (!motionOn()) return;
  const face = el.querySelector('canvas'), back = el.querySelector('.ah-cardback'), timing = { duration: 320, delay, fill: 'backwards' as const };
  face?.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(0)', offset: 0.5 }, { transform: 'scaleX(1)' }], timing);
  back?.animate([{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 1, transform: 'scaleX(0)', offset: 0.5 }, { opacity: 0, transform: 'scaleX(0)' }], timing);
}

/** Send a copy of `el` from where it is to `to` (or off the right edge for 'away'), then drop the copy. */
export function fly(el: Element | null, to: Box | 'away', opts: { duration?: number; delay?: number; spin?: number; fade?: boolean; drop?: number } = {}) {
  if (!el || !motionOn()) return;
  const from = box(el), ghost = el.cloneNode(true) as HTMLElement;
  for (const n of [ghost, ...ghost.querySelectorAll('[data-testid],[data-card-id],[data-fly]')]) { n.removeAttribute('data-testid'); n.removeAttribute('data-card-id'); n.removeAttribute('data-fly'); }
  const src = el.querySelectorAll('canvas'), dst = ghost.querySelectorAll('canvas');
  dst.forEach((c, i) => { try { c.getContext('2d')?.drawImage(src[i], 0, 0); } catch { /* a blank copy still moves */ } });
  ghost.classList.add('ah-ghost'); ghost.setAttribute('aria-hidden', 'true'); ghost.removeAttribute('id');
  Object.assign(ghost.style, { position: 'fixed', left: `${from.x}px`, top: `${from.y}px`, width: `${from.w}px`, height: `${from.h}px`, margin: '0', pointerEvents: 'none', zIndex: '50', transform: 'none' });
  host().appendChild(ghost);
  const end = to === 'away' ? { x: innerWidth + from.w, y: from.y + (opts.drop ?? 60), w: from.w, h: from.h } : to;
  const dx = end.x + end.w / 2 - (from.x + from.w / 2), dy = end.y + end.h / 2 - (from.y + from.h / 2), s = end.w / (from.w || 1);
  const a = ghost.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) rotate(${opts.spin ?? 0}deg) scale(${s})`, opacity: opts.fade ? 0 : 1 }],
    { duration: opts.duration ?? 380, delay: opts.delay ?? 0, easing: 'cubic-bezier(.45,0,.7,.4)', fill: 'both' });
  a.onfinish = () => ghost.remove(); a.oncancel = () => ghost.remove();
}

/** Throw a little emoji from one box to another in an arc. */
export function toss(text: string, from: Box | null, to: Box | null, delay = 0) {
  if (!from || !to || !motionOn()) return;
  const bit = document.createElement('span');
  bit.className = 'ah-toss'; bit.textContent = text; bit.setAttribute('aria-hidden', 'true');
  bit.style.left = `${from.x + from.w / 2}px`; bit.style.top = `${from.y + from.h / 2}px`;
  host().appendChild(bit);
  const dx = to.x + to.w / 2 - (from.x + from.w / 2), dy = to.y + to.h / 2 - (from.y + from.h / 2);
  const a = bit.animate([
    { transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 },
    { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2 - 60}px)) scale(1.2)`, opacity: 1, offset: 0.5 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.8)`, opacity: 0.9 },
  ], { duration: 520, delay, easing: 'ease-in-out', fill: 'both' });
  a.onfinish = () => bit.remove(); a.oncancel = () => bit.remove();
}

/** A puff of paper bits from the centre of a box. */
export function burst(at: Box | null, color: string, n = 12) {
  if (!at || !motionOn()) return;
  for (let i = 0; i < n; i++) {
    const bit = document.createElement('span'), a = (i / n) * Math.PI * 2 + (i % 3) * 0.3, d = 60 + (i % 4) * 16;
    bit.className = 'ah-bit'; bit.setAttribute('aria-hidden', 'true'); bit.style.background = color;
    bit.style.left = `${at.x + at.w / 2}px`; bit.style.top = `${at.y + at.h / 2}px`;
    host().appendChild(bit);
    const an = bit.animate([{ transform: 'translate(-50%, -50%) rotate(0)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) rotate(${200 + i * 40}deg)`, opacity: 0 }],
      { duration: 600, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });
    an.onfinish = () => bit.remove(); an.oncancel = () => bit.remove();
  }
}

/** Fan elements out one by one from a box, as if they came out of it. */
export function emerge(els: Iterable<Element>, from: Box | null, gap = 90) {
  if (!from || !motionOn()) return;
  let i = 0;
  for (const el of els) {
    const b = box(el), dx = from.x + from.w / 2 - (b.x + b.w / 2), dy = from.y + from.h / 2 - (b.y + b.h / 2);
    el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(.3) rotate(-8deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: gap * i++, easing: SPRING, fill: 'backwards' });
  }
}

export function play(el: Element | null, frames: Keyframe[], opts: KeyframeAnimationOptions = {}) {
  if (!el || !motionOn()) return null;
  return el.animate(frames, { duration: 400, easing: 'ease-out', ...opts });
}

/** Shake the table: `strength` 0 to 1 sets how far, up to 8 px. */
export function shake(el: Element | null, strength: number) {
  const p = Math.round(2 + 6 * Math.min(1, Math.max(0, strength)));
  play(el, [{ transform: 'none' }, { transform: `translate(${-p}px, ${p / 2}px)` }, { transform: `translate(${p}px, ${-p / 2}px)` }, { transform: `translate(${-p / 2}px, 0)` }, { transform: 'none' }], { duration: 300 });
}

/** Remove any copies still in flight, for when the page goes away mid-motion. */
export const dropGhosts = () => { if (typeof document !== 'undefined') document.querySelectorAll('.ah-ghost, .ah-toss, .ah-bit').forEach((n) => n.remove()); };

/** A number that counts toward `value` over `ms` while `active`; otherwise exactly `value`. */
export function useTicker(value: number, active: boolean, ms = 140) {
  const [shown, setShown] = useState(value), from = useRef(value);
  useEffect(() => {
    if (!active || !motionOn()) { from.current = value; setShown(value); return; }
    const start = performance.now(), a = from.current; let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - start) / ms), v = a + (value - a) * (1 - (1 - k) ** 3); from.current = v; setShown(v); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, active, ms]);
  return active && motionOn() ? shown : value;
}

export const POP: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.35 }, { transform: 'scale(1)' }];
export const PUNCH: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.3) rotate(-3deg)', offset: 0.3 }, { transform: 'scale(.96)', offset: 0.6 }, { transform: 'scale(1)' }];
export const HOP: Keyframe[] = [{ transform: 'none' }, { transform: 'translateY(-10px)', offset: 0.4 }, { transform: 'none' }];
export const WIGGLE: Keyframe[] = [
  { transform: 'none', filter: 'none' }, { transform: 'rotate(-6deg) scale(1.08)', filter: 'drop-shadow(0 0 10px #ffd76a)', offset: 0.2 },
  { transform: 'rotate(6deg) scale(1.08)', offset: 0.45 }, { transform: 'rotate(-4deg) scale(1.04)', offset: 0.7 }, { transform: 'none', filter: 'none' },
];
export const STAMP: Keyframe[] = [{ transform: 'scale(1.3)', opacity: 0.4 }, { transform: 'scale(.95)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }];
export const FLIP_IN: Keyframe[] = [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }];
export const FLARE: Keyframe[] = [{ filter: 'none' }, { filter: 'drop-shadow(0 0 10px #ffd76a) brightness(1.4)', offset: 0.3 }, { filter: 'none' }];
export const REACT: Record<'enter' | 'discard' | 'hit' | 'big' | 'rule' | 'beaten' | 'gloat', [Keyframe[], KeyframeAnimationOptions]> = {
  enter: [[{ transform: 'translateY(-30px)', opacity: 0 }, { transform: 'translateY(4px)', opacity: 1, offset: 0.6 }, { transform: 'translateY(-6px)', offset: 0.8 }, { transform: 'none' }], { duration: 700 }],
  discard: [[{ transform: 'none' }, { transform: 'translateX(8px) rotate(6deg)', offset: 0.3 }, { transform: 'translateX(8px) rotate(6deg)', offset: 0.7 }, { transform: 'none' }], { duration: 900 }],
  hit: [[{ transform: 'none' }, { transform: 'translateX(-6px) rotate(-4deg)', offset: 0.4 }, { transform: 'none' }], { duration: 300 }],
  big: [[{ transform: 'none' }, { transform: 'translate(-14px, -4px) rotate(-10deg) scale(.95)', offset: 0.2 }, { transform: 'translateX(6px) rotate(5deg)', offset: 0.45 }, { transform: 'translateX(-3px) rotate(-2deg)', offset: 0.7 }, { transform: 'none' }], { duration: 700 }],
  rule: [[{ transform: 'none' }, { transform: 'translateY(-10px) scale(1.06)', offset: 0.3 }, { transform: 'none', offset: 0.5 }, { transform: 'translateY(-5px)', offset: 0.7 }, { transform: 'none' }], { duration: 600 }],
  beaten: [[{ transform: 'none', filter: 'none' }, { transform: 'translateY(10px) rotate(-8deg) scale(.94)', filter: 'grayscale(.8) brightness(.8)' }], { duration: 600, fill: 'forwards' }],
  gloat: [[{ transform: 'none' }, { transform: 'translateY(-14px)', offset: 0.25 }, { transform: 'none', offset: 0.5 }, { transform: 'translateY(-8px)', offset: 0.75 }, { transform: 'none' }], { duration: 700, iterations: 2 }],
};
