import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Moonpond · Dora & Enzo's Arcade",
  description:
    'A night-fishing journal: cast from the dock, hook the bite, work the reel, then sketch each pond creature and let it go. Forty journal pages decided by where you cast, the hour, the weather, the lure and the moon. Local saves.',
};
export default function MoonpondLayout({ children }: { children: React.ReactNode }) {
  return children;
}
