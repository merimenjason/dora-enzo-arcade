import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Above & Below · Dora & Enzo’s Arcade',
  description: 'A two-hero cross-section co-op platformer. Dora works the sunny meadow, Enzo digs through the burrows below, and every puzzle needs both: open the sluice so Enzo can sail, hold a root bridge up while Dora crosses, stamp the clay loose for him to dig, and put Old Grubber to sleep. Solo with a swap, or two players on one keyboard.',
};
export default function AboveAndBelowLayout({ children }: { children: React.ReactNode }) { return children; }
