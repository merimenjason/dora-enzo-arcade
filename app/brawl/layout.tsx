import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hay Bale Brawl · Dora & Enzo’s Arcade',
  description: 'An auto-battler: buy a crew of woodland critters, line them up on a hay bale and watch them brawl rival crews.',
};

export default function BrawlLayout({ children }: { children: React.ReactNode }) {
  return children;
}
