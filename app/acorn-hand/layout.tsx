import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Acorn Hand · Dora & Enzo’s Arcade',
  description: 'A poker-scoring card run: play hands for chips × mult, gather chinchilla charms that bend the rules, and beat eight antes of woodland rivals.',
};

export default function AcornHandLayout({ children }: { children: React.ReactNode }) {
  return children;
}
