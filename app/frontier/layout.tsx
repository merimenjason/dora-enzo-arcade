import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Frostpaw Frontier · Dora & Enzo's Arcade",
  description:
    'A tile-by-tile survival builder in the style of Tiles Survive: explore a snowy mountain under the cloud, put chinchilla survivors to work, recruit heroes, clear predator dens, hold off the night raids and light the Summit Beacon. Three maps, local saves.',
};
export default function FrontierLayout({ children }: { children: React.ReactNode }) {
  return children;
}
