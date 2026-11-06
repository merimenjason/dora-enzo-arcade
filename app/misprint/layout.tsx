import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Misprint · Dora & Enzo’s Arcade', description: 'A cosy two-ink risograph puzzle: Dora walks on pink, Enzo on teal, and you can slide either ink plate out of register to get them both to the staple. Thirty pages in three zines.' };
export default function MisprintLayout({ children }: { children: React.ReactNode }) { return children; }
