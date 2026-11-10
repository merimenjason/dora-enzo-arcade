import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Salt & Dust · Dora & Enzo’s Arcade',
  description: 'An isometric, turn-based exploration RPG in a high-Andean salt desert after the rains stopped. Dora and Enzo cross the salt flat with a draining canteen, talk their way past Well Wardens, Brine Guild merchants and Dust Runners with skill checks, or fight on a grid with action points. A first playable chapter.',
};
export default function SaltDustLayout({ children }: { children: React.ReactNode }) { return children; }
