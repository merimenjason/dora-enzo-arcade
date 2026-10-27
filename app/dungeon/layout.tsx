import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Dust Bunny Dungeon · Dora & Enzo’s Arcade', description: 'A turn-based roguelike: tidy twelve cellar floors of mischievous dust bunnies with Dora or Enzo. Every bunny shows its next move, so push, bop and plan your way to the Dust King.' };
export default function DungeonLayout({ children }: { children: React.ReactNode }) { return children; }
