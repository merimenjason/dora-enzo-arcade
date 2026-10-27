import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Fluff Roll · Dora & Enzo’s Arcade', description: 'Roll a dust ball round the meadow with Dora and Enzo. Everything smaller sticks to it, from seeds and buttons to hay bales and barns.' };
export default function RollLayout({ children }: { children: React.ReactNode }) { return children; }
