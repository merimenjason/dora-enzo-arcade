// Cloudpop UI helpers: atlas sprites as CSS backgrounds, icons, painted buttons, and localStorage wrapped in try/catch.
import type { CSSProperties, ReactNode } from 'react';
import { FRAMES, ATLASES, ATLAS_SIZE } from '@/lib/cloudpop-art';

export const ART = '/art/cloudpop/';

export function spriteStyle(name: string, h: number, w?: number): CSSProperties | null {
  const f = FRAMES[name]; if (!f) return null;
  const atlas = ATLASES[f[0]]; const [aw, ah] = ATLAS_SIZE[atlas] ?? [2048, 1024];
  const k = w ? Math.min(w / f[3], h / f[4]) : h / f[4];
  return {
    width: `${f[3] * k}px`, height: `${f[4] * k}px`, backgroundImage: `url(${ART}${atlas}.webp)`,
    backgroundSize: `${aw * k}px ${ah * k}px`, backgroundPosition: `${-f[1] * k}px ${-f[2] * k}px`,
  };
}
type SprProps = { name: string; h: number; w?: number; cls?: string; style?: CSSProperties; title?: string };
export function Sprite({ name, h, w, cls = '', style, title }: SprProps) {
  const st = spriteStyle(name, h, w);
  return <span className={'spr ' + cls} data-spr={name} data-missing={st ? undefined : name} title={title} style={{ ...(st ?? { width: h, height: h }), ...style }} />;
}
export const Icon = ({ name, size = 24, cls = '' }: { name: string; size?: number; cls?: string }) => <Sprite name={'i-' + name} h={size} w={size} cls={'ico ' + cls} />;

export function Btn({ children, onClick, kind = 'teal', disabled, cls = '', title, id, testid }: { children: ReactNode; onClick?: () => void; kind?: 'teal' | 'red' | 'gold' | 'plain'; disabled?: boolean; cls?: string; title?: string; id?: string; testid?: string }) {
  return <button id={id} data-testid={testid} className={`cbtn ${kind} ${cls}`} disabled={disabled} title={title} onClick={onClick}>{children}</button>;
}

export function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === '') localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { /* private mode or blocked storage: play on without saving */ }
  return null;
}
export const fmt = (n: number) => Math.floor(n).toLocaleString('en-GB');
