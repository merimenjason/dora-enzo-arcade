import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Out of Frame · Dora & Enzo’s Arcade', description: 'A pixel-art puzzle platformer where only what is inside Enzo’s camera viewfinder moves. Dora walks on her own; point the frame to keep her going, freeze Grumbles into steps, boulders into lids and arrows into bridges, and get through nine screens before the film runs out.' };
export default function FrameLayout({ children }: { children: React.ReactNode }) { return children; }
