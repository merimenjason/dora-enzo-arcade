import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Overclock · Dora & Enzo’s Arcade',
  description: 'A 16-bit run-and-gun across a neon future city: Dora and Enzo tag-swap through eight stages, reboot eight runaway robot bosses, earn sixteen powers, and climb Lumen’s tower. Assist mode on by default.',
};
export default function OverclockLayout({ children }: { children: React.ReactNode }) { return children; }
