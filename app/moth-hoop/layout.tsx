import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Moth Hoop · Dora & Enzo’s Arcade',
  description: 'A thread shooter drawn entirely in cross stitch. Dora and Enzo ride cotton reels under Ah Ma’s embroidery hoop, throwing needles up to stitch six Singapore kit pictures, from a kopitiam breakfast to National Day fireworks, while pinning the moths that chew them.',
};
export default function MothLayout({ children }: { children: React.ReactNode }) { return children; }
