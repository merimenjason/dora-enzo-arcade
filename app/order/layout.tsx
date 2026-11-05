import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Turn Order · Dora & Enzo’s Arcade', description: 'A pixel-art puzzle roguelite where you can’t move a single piece. Every garden critter does its one thing each round, in the order of the queue, and Enzo can only swap two neighbours a round to get the golden acorn into Dora’s pot. Eleven gardens and the Grumble King’s bed.' };
export default function OrderLayout({ children }: { children: React.ReactNode }) { return children; }
