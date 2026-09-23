import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Fluffstevania: Symphony of the Dust · Dora & Enzo's Arcade",
  description:
    'Dora and Enzo explore a haunted mountain castle for the Golden Wolfberry. Tag between them, level up, find relics and gear, and face Duke Hootsworth in the belfry. Saves at dust-bath shrines.',
};
export default function FluffstevaniaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
