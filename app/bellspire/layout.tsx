import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'The Sunken Bellspire · Dora & Enzo’s Arcade',
  description: 'A hi-bit pixel castle explorer: Dora and Enzo explore a drowned citadel of bells under a high Andean lake, lit by lantern light. Tag between them, ring bells to raise and lower the water, find seven abilities, and calm five guardians. Assist mode on by default.',
};
export default function BellspireLayout({ children }: { children: React.ReactNode }) { return children; }
