import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Dusty Hollow · Dora & Enzo's Arcade",
  description:
    'A cozy village-life game. Fish, catch bugs, dig fossils, shake fruit trees, befriend the neighbours and pay off your burrow in a little Andean hollow. No accounts, local saves.',
};
export default function DustyHollowLayout({ children }: { children: React.ReactNode }) {
  return children;
}
