import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Neon Lane · Dora & Enzo’s Arcade',
  description: 'A maze chase on a neon signboard up Geylang Road. Dora and Enzo run the glass tubes eating sparks while cicak geckos hunt them through the glow: clear a circuit and it goes dark, and in the dark the cicaks cannot see you. Blow a fuse to turn the chase round.',
};
export default function NeonLaneLayout({ children }: { children: React.ReactNode }) { return children; }
