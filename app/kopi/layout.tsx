import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Kopi Peng Brawl · Dora & Enzo’s Arcade',
  description: 'A two-hero belt brawler across one long night in Singapore, drawn as a kung-fu comic. Dora and Enzo fight side by side from Lau Pa Sat to Changi Beach, grab trays, stools and durians, team up with the hawkers, and take on rats, macaques, mynahs, monitors, pythons, toads, boars and the Macaque King.',
};
export default function KopiLayout({ children }: { children: React.ReactNode }) { return children; }
