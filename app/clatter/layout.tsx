import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Clatterbox · Dora & Enzo’s Arcade', description: 'A chain-reaction contraption puzzle in a cardboard box. Place a few ramps, dominoes, springs, fans, scissors and candles, press Go and watch it clatter: ring the bell, wake the hedgehog, feed the sparrow. Thirty puzzles in five rooms, three acorns a puzzle, a free build and the Big Show for the neighbours.' };
export default function ClatterLayout({ children }: { children: React.ReactNode }) { return children; }
